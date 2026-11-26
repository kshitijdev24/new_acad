import express from 'express';
import { access } from 'node:fs/promises';
import mongoose from 'mongoose';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { ZodError, z } from 'zod';
import { Assignment, Course, CourseEnrollment, Semester, Student, Submission } from '../models.js';
import {
  assignmentTemporaryDirectory,
  ensureAssignmentStorage,
  hashAssignmentFile,
  maximumAssignmentUploadBytes,
  promoteAssignmentFile,
  removeTemporaryAssignmentFile,
  resolveAssignmentFile,
  scanAssignmentFile,
  temporaryAssignmentFilename,
  validateAssignmentUpload,
} from '../storage/assignmentStorage.js';
import { parseAssignmentDueDate } from '../services/assignmentStatus.js';
import {
  getStudentForUser,
  invalidatePerformanceCache,
  recomputeAssignmentStats,
} from '../services/performanceService.js';
import {
  AssignmentError,
  assignmentSubmissionForDownload,
  canManageCourse,
  createAssignment,
  deleteNotification,
  deleteAssignment,
  getAssignmentByIdForUser,
  getAssignmentDetails,
  getAssignmentStats,
  gradeAssignment,
  listAssignments,
  listCourseAssignmentSubmissions,
  listMyCourses,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  submitAssignment,
  toggleAssignmentCompletion,
  updateAssignment,
  writeAudit,
} from '../services/assignmentService.js';
import { asyncHandler, featureErrorHandler, sendSuccess } from '../utils/http.js';
import {
  assignmentCreateSchema,
  assignmentIdSchema,
  assignmentListSchema,
  assignmentPatchSchema,
  completionSchema,
  gradeAssignmentSchema,
  notificationListSchema,
  submitSchema,
} from '../validation/assignmentSchemas.js';

const router = express.Router();
const requestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many assignment requests. Try again shortly.', data: null },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many upload attempts. Try again shortly.', data: null },
});
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      ensureAssignmentStorage().then(
        () => callback(null, assignmentTemporaryDirectory()),
        callback
      );
    },
    filename: (_req, _file, callback) => callback(null, temporaryAssignmentFilename()),
  }),
  limits: { fileSize: maximumAssignmentUploadBytes(), files: 1 },
});
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'Assignment Tracker API', version: '1.0.0' },
  paths: {
    '/assignments': {
      get: { summary: 'List assignments visible to the signed-in user', responses: { 200: { description: 'Assignments, pagination, and computed statistics' } } },
      post: { summary: 'Create a personal or faculty assignment', responses: { 201: { description: 'Created assignment' } } },
    },
    '/assignments/stats': { get: { summary: 'Get server-computed assignment statistics', responses: { 200: { description: 'Assignment totals' } } } },
    '/assignments/courses': { get: { summary: 'List courses available to the signed-in user', responses: { 200: { description: 'Authorized courses' } } } },
    '/assignments/{id}': {
      get: { summary: 'Read an authorized assignment', responses: { 200: { description: 'Assignment details' } } },
      patch: { summary: 'Update an owned assignment', responses: { 200: { description: 'Updated assignment' } } },
      delete: { summary: 'Soft-delete an owned assignment', responses: { 200: { description: 'Deletion result' } } },
    },
    '/assignments/{id}/completion': { patch: { summary: 'Toggle a personal assignment completion state', responses: { 200: { description: 'Updated assignment' } } } },
    '/assignments/{id}/submissions': { post: { summary: 'Upload a submission file', responses: { 201: { description: 'Submission result' } } } },
    '/submissions/{id}/grade': { patch: { summary: 'Grade a submission (faculty/admin)', responses: { 200: { description: 'Grade result' } } } },
    '/submissions/{id}/download': { get: { summary: 'Download an authorized submission file', responses: { 200: { description: 'Attachment' } } } },
    '/notifications': { get: { summary: 'List the signed-in user notifications', responses: { 200: { description: 'Paginated notifications' } } } },
  },
};

router.use(requestLimiter);
router.get('/assignments/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

function assertMongo(next) {
  if (mongoose.connection.readyState !== 1) {
    next(new AssignmentError(503, 'Assignments require an active MongoDB connection.'));
    return false;
  }
  return true;
}

function parseDueDate(value) {
  try {
    return parseAssignmentDueDate(value);
  } catch (error) {
    throw new AssignmentError(400, error.message);
  }
}

async function createSemesterAssignment(user, input, dueDate) {
  if (!['admin', 'faculty'].includes(user.role)) {
    throw new AssignmentError(403, 'Only faculty and admins can create semester assignments.');
  }
  const course = mongoose.isValidObjectId(input.courseId)
    ? await Course.findById(input.courseId)
    : await Course.findOne({ code: String(input.courseId).trim().toUpperCase() });
  if (!course) throw new AssignmentError(404, 'Course not found.');
  if (!(await canManageCourse(user, course))) {
    throw new AssignmentError(403, 'You may only manage assignments for your courses.');
  }
  const semester = await Semester.findById(input.semesterId);
  if (!semester) throw new AssignmentError(404, 'Semester not found.');
  const enrollment = await CourseEnrollment.exists({
    studentId: semester.studentId,
    semesterId: semester._id,
    courseId: course._id,
  });
  if (!enrollment) throw new AssignmentError(400, 'The course is not enrolled in this semester.');
  const student = await Student.findById(semester.studentId).select('cohortId').lean();
  const maxMarks = input.maxMarks ?? input.maxScore;
  const assignment = await Assignment.create({
    id: `perf-${new mongoose.Types.ObjectId().toString()}`,
    title: input.title,
    courseCode: course.code,
    courseId: course._id,
    semesterId: semester._id,
    institutionId: course.institutionId || user.institutionId,
    createdBy: String(user.id || user._id),
    source: 'faculty',
    lifecycleStatus: 'published',
    type: input.type || 'assignment',
    dueDate,
    maxScore: maxMarks,
    maxMarks,
    weightPercent: input.weightPercent,
    cohortId: input.cohortId || student?.cohortId || '',
    status: 'Pending',
  });
  await writeAudit(req, assignment, 'assignment.created', null, {
    id: assignment.id,
    title: assignment.title,
    courseId: assignment.courseId,
    courseCode: assignment.courseCode,
    semesterId: assignment.semesterId,
    source: assignment.source,
    dueDate: assignment.dueDate,
    weightPercent: assignment.weightPercent,
    maxMarks: assignment.maxMarks,
    type: assignment.type,
  });
  await recomputeAssignmentStats(assignment._id);
  invalidatePerformanceCache();
  return assignment;
}

router.get('/assignments', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const query = assignmentListSchema.parse(req.query);
  const [result, stats] = await Promise.all([
    listAssignments(req.user, query),
    getAssignmentStats(req.user),
  ]);
  return sendSuccess(res, 'Assignments loaded.', { ...result, stats });
}));

router.get('/assignments/stats', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  return sendSuccess(res, 'Assignment statistics loaded.', await getAssignmentStats(req.user));
}));

router.get('/assignments/courses', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  return sendSuccess(res, 'Courses loaded.', await listMyCourses(req.user));
}));

router.post('/assignments', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const input = assignmentCreateSchema.parse(req.body);
  req.assignmentDueDate = parseDueDate(input.dueDate);
  if (input.semesterId) {
    return sendSuccess(
      res,
      'Assignment created.',
      await createSemesterAssignment(req.user, input, req.assignmentDueDate),
      201
    );
  }
  input.maxMarks = input.maxMarks ?? input.maxScore;
  const assignment = await createAssignment(req.user, input, req);
  return sendSuccess(res, 'Assignment created.', assignment, 201);
}));

router.get('/assignments/:id', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  return sendSuccess(res, 'Assignment loaded.', await getAssignmentDetails(req.user, id));
}));

router.patch('/assignments/:id', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  const input = assignmentPatchSchema.parse(req.body);
  if (input.dueDate !== undefined) req.assignmentDueDate = parseDueDate(input.dueDate);
  const assignment = await getAssignmentByIdForUser(req.user, id);
  return sendSuccess(res, 'Assignment updated.', await updateAssignment(req.user, assignment, input, req));
}));

router.delete('/assignments/:id', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  const assignment = await getAssignmentByIdForUser(req.user, id);
  return sendSuccess(res, 'Assignment deleted.', await deleteAssignment(req.user, assignment, req));
}));

router.patch('/assignments/:id/completion', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  const { completed } = completionSchema.parse(req.body);
  const assignment = await getAssignmentByIdForUser(req.user, id);
  return sendSuccess(
    res,
    'Assignment completion updated.',
    await toggleAssignmentCompletion(req.user, assignment, completed, req)
  );
}));

router.post('/assignments/:id/submissions', uploadLimiter, (req, res, next) => {
  if (!assertMongo(next)) return;
  upload.single('file')(req, res, next);
}, asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) {
    await removeTemporaryAssignmentFile(req.file?.path);
    return;
  }
  try {
    const id = assignmentIdSchema.parse(req.params.id);
    const { note } = submitSchema.parse({ note: req.body?.note });
    if (!req.file) throw new AssignmentError(400, 'Choose a file to submit.');
    const assignment = await getAssignmentByIdForUser(req.user, id);
    if (req.user.role !== 'student') throw new AssignmentError(403, 'Only students can submit assignments.');
    const student = await getStudentForUser(req.user);
    const validatedFile = await validateAssignmentUpload(req.file, assignment);
    await scanAssignmentFile(req.file.path);
    const sha256 = await hashAssignmentFile(req.file.path);
    req.promoteAssignmentFile = (targetAssignment, targetStudent, hash, extension) =>
      promoteAssignmentFile(
        req.file.path,
        targetAssignment._id,
        targetStudent._id,
        hash,
        extension
      );
    const result = await submitAssignment(
      req.user,
      assignment,
      student,
      req.file,
      validatedFile,
      sha256,
      note,
      req
    );
    return sendSuccess(res, 'Assignment submitted.', result, 201);
  } finally {
    await removeTemporaryAssignmentFile(req.file?.path);
  }
}));

router.get('/courses/:courseId/assignments/:assignmentId/submissions', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const assignmentId = assignmentIdSchema.parse(req.params.assignmentId);
  const query = paginationSchema.parse(req.query);
  const result = await listCourseAssignmentSubmissions(
    req.user,
    req.params.courseId,
    assignmentId,
    query
  );
  return sendSuccess(res, 'Assignment submissions loaded.', result);
}));

router.patch('/submissions/:id/grade', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  const parsedInput = gradeAssignmentSchema.parse(req.body);
  const input = {
    obtainedMarks: parsedInput.obtainedMarks ?? parsedInput.score,
    feedback: parsedInput.feedback,
  };
  const submission = await Submission.findById(id);
  if (!submission) throw new AssignmentError(404, 'Submission not found.');
  return sendSuccess(res, 'Submission graded.', await gradeAssignment(req.user, submission, input, req));
}));

router.get('/submissions/:id/download', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  const { file } = await assignmentSubmissionForDownload(req.user, id);
  const filePath = resolveAssignmentFile(file.storageKey);
  try {
    await access(filePath);
  } catch {
    throw new AssignmentError(404, 'Submission file not found.');
  }
  return res.download(filePath, file.originalName, (error) => {
    if (error && !res.headersSent) next(new AssignmentError(404, 'Submission file not found.'));
  });
}));

router.get('/notifications', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const query = notificationListSchema.parse(req.query);
  return sendSuccess(res, 'Notifications loaded.', await listUserNotifications(req.user, query));
}));

router.patch('/notifications/:id/read', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  return sendSuccess(res, 'Notification marked as read.', await markNotificationRead(req.user, id));
}));

router.delete('/notifications/:id', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  const id = assignmentIdSchema.parse(req.params.id);
  return sendSuccess(res, 'Notification deleted.', await deleteNotification(req.user, id));
}));

router.post('/notifications/read-all', asyncHandler(async (req, res, next) => {
  if (!assertMongo(next)) return;
  return sendSuccess(res, 'Notifications marked as read.', await markAllNotificationsRead(req.user));
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof AssignmentError) {
    return res.status(error.status).json({ success: false, message: error.message, data: null });
  }
  if (error instanceof multer.MulterError || error instanceof ZodError || error.code === 11000) {
    return featureErrorHandler(error, req, res, next);
  }
  const status = Number(error.status) || 500;
  if (status >= 500) console.error('[Assignment API] An internal request failed.');
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'The assignment request could not be completed.' : error.message,
    data: null,
  });
});

export default router;
