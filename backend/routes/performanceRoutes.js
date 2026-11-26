import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import {
  AcademicSettings,
  Assignment,
  Course,
  CourseEnrollment,
  Semester,
  Student,
  Submission,
} from '../models.js';
import { asyncHandler, requireFeatureAuth, sendSuccess } from '../utils/http.js';
import { assertStudentAccess } from '../services/performanceAuthorization.js';
import {
  academicSettingsQuerySchema,
  academicSettingsSchema,
  assignmentInputSchema,
  assignmentPatchSchema,
  gradeInputSchema,
  listQuerySchema,
  objectId,
  performanceQuerySchema,
  performanceExportQuerySchema,
  semesterInputSchema,
  semesterPatchSchema,
  submissionInputSchema,
} from '../validation/performanceSchemas.js';
import {
  getAcademicSettings,
  getPerformanceTrend,
  getStudentForUser,
  invalidatePerformanceCache,
  listStudentAssignments,
  listStudentSemesters,
  PerformanceError,
  recomputeAssignmentStats,
  recomputeStudentSemesters,
  saveSemesterWithEnrollments,
} from '../services/performanceService.js';

const router = express.Router();
const requestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many performance requests. Try again shortly.', data: null },
});

const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'Academic Performance API', version: '1.0.0' },
  paths: {
    '/students/me/performance-trend': {
      get: {
        summary: 'Get the signed-in student trend and analytics',
        parameters: [
          { in: 'query', name: 'fromSemester', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'toSemester', schema: { type: 'integer', minimum: 1 } },
          { in: 'query', name: 'courseId', schema: { type: 'string' } },
          { in: 'query', name: 'includeCohort', schema: { type: 'boolean', default: true } },
        ],
        responses: { 200: { description: 'Trend, assignments, KPIs, and metadata' }, 401: { description: 'Authentication required' } },
      },
    },
    '/students/{id}/performance-trend': {
      get: {
        summary: 'Get a student trend (admin, faculty, or advisor)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Trend data' }, 403: { description: 'Insufficient role' } },
      },
    },
    '/students/me/semesters': { get: { summary: 'List the signed-in student semesters', responses: { 200: { description: 'Paginated semesters' } } } },
    '/semesters': {
      post: { summary: 'Create a semester and course enrollments', responses: { 201: { description: 'Created semester' } } },
    },
    '/semesters/{id}': {
      patch: { summary: 'Update a semester', responses: { 200: { description: 'Updated semester' } } },
    },
    '/semesters/{id}/recompute': {
      post: { summary: 'Recompute semester and cumulative GPA', responses: { 200: { description: 'Recomputed metrics' } } },
    },
    '/students/me/assignments': {
      get: { summary: 'List the signed-in student assignments', responses: { 200: { description: 'Paginated assignments' } } },
    },
    '/assignments': {
      post: { summary: 'Create an assignment (faculty/admin)', responses: { 201: { description: 'Created assignment' } } },
    },
    '/assignments/{id}': {
      patch: { summary: 'Update an assignment (faculty/admin)', responses: { 200: { description: 'Updated assignment' } } },
    },
    '/assignments/{id}/submissions': {
      post: { summary: 'Submit an assignment as the signed-in student', responses: { 201: { description: 'Submission recorded' } } },
    },
    '/submissions/{id}/grade': {
      patch: { summary: 'Grade a submission (faculty/admin)', responses: { 200: { description: 'Grade recorded' } } },
    },
    '/settings/academic': {
      get: { summary: 'Read academic settings (admin)', responses: { 200: { description: 'Academic settings' } } },
      put: { summary: 'Update academic settings (admin)', responses: { 200: { description: 'Updated academic settings' } } },
    },
    '/students/me/performance-trend/export': {
      get: { summary: 'Export trend data as CSV', parameters: [{ in: 'query', name: 'format', schema: { type: 'string', enum: ['csv'] } }], responses: { 200: { description: 'CSV download' } } },
    },
  },
};

function requireMongo(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    next(new PerformanceError(503, 'Academic performance requires an active MongoDB connection.'));
    return;
  }
  next();
}

function studentIdOf(student) {
  return String(student._id);
}

async function findStudent(identifier) {
  const student = mongoose.isValidObjectId(identifier)
    ? await Student.findOne({ $or: [{ _id: identifier }, { userId: String(identifier) }] })
    : await Student.findOne({ userId: String(identifier) });
  if (!student) throw new PerformanceError(404, 'Student not found.');
  return student;
}

async function getOwnedStudent(user) {
  const student = await getStudentForUser(user);
  assertStudentAccess(user, student);
  return student;
}

async function findCourse(identifier) {
  const course = mongoose.isValidObjectId(identifier)
    ? await Course.findById(identifier)
    : await Course.findOne({ code: identifier });
  if (!course) throw new PerformanceError(404, 'Course not found.');
  return course;
}

function canManageCourse(user, course) {
  return user.role === 'admin'
    || (user.role === 'faculty'
      && (String(course.facultyUserId || '') === String(user.id)
        || String(course.facultyName || '').toLowerCase() === String(user.name || '').toLowerCase()));
}

async function assertFacultyCourses(user, student, semesterIds, requestedCourseId) {
  if (user.role !== 'faculty') return null;
  const enrollments = await CourseEnrollment.find({
    studentId: student._id,
    semesterId: { $in: semesterIds },
  }).distinct('courseId');
  const query = { _id: { $in: enrollments } };
  query.$or = [
    { facultyUserId: String(user.id) },
    { facultyName: new RegExp(`^${String(user.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  ];
  const courses = await Course.find(query).select('_id').lean();
  const allowedIds = courses.map((course) => course._id);
  if (!allowedIds.length) throw new PerformanceError(403, 'You do not teach courses for this student.');
  if (requestedCourseId) {
    const requested = await findCourse(requestedCourseId);
    if (!allowedIds.some((id) => String(id) === String(requested._id))) {
      throw new PerformanceError(403, 'You do not have access to this course.');
    }
  }
  return allowedIds;
}

async function studentForSemesterInput(input, user) {
  const student = await findStudent(input.studentId);
  if (user.role === 'faculty') {
    const courseIds = (input.enrollments || []).map((item) => item.courseId);
    if (!courseIds.length) throw new PerformanceError(403, 'Faculty must manage a course they teach.');
    const courses = await Course.find({ _id: { $in: courseIds } });
    if (courses.length !== courseIds.length || courses.some((course) => !canManageCourse(user, course))) {
      throw new PerformanceError(403, 'You may only manage your own courses.');
    }
  }
  return student;
}

async function assertFacultyCanManageSemester(user, semester, additionalCourseIds = []) {
  if (user.role !== 'faculty') return;
  const existingCourseIds = await CourseEnrollment.find({
    studentId: semester.studentId,
    semesterId: semester._id,
  }).distinct('courseId');
  const existingCourses = await Course.find({ _id: { $in: existingCourseIds } });
  if (!existingCourses.some((course) => canManageCourse(user, course))) {
    throw new PerformanceError(403, 'You do not teach courses in this semester.');
  }
  if (additionalCourseIds.length) {
    const additionalCourses = await Course.find({ _id: { $in: additionalCourseIds } });
    if (additionalCourses.length !== additionalCourseIds.length
      || additionalCourses.some((course) => !canManageCourse(user, course))) {
      throw new PerformanceError(403, 'You may only manage your own courses.');
    }
  }
}

async function assertFacultyAssignment(user, assignment) {
  const course = await Course.findById(assignment.courseId);
  if (!course || !canManageCourse(user, course)) {
    throw new PerformanceError(403, 'You may only manage assignments for your courses.');
  }
  return course;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

router.use(requestLimiter, requireFeatureAuth, requireMongo);
router.get('/performance-trend/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

router.get('/students/me/performance-trend', asyncHandler(async (req, res) => {
  const query = performanceQuerySchema.parse(req.query);
  const student = await getOwnedStudent(req.user);
  const semesters = await Semester.find({ studentId: student._id }).select('_id').lean();
  const allowedCourseIds = await assertFacultyCourses(
    req.user,
    student,
    semesters.map((semester) => semester._id),
    query.courseId
  );
  const data = await getPerformanceTrend(student, {
    ...query,
    allowedCourseIds: allowedCourseIds || undefined,
  });
  return sendSuccess(res, 'Performance trend loaded.', data);
}));

router.get('/students/me/performance-trend/export', asyncHandler(async (req, res) => {
  const query = performanceExportQuerySchema.parse(req.query);
  const student = await getOwnedStudent(req.user);
  const data = await getPerformanceTrend(student, query);
  const rows = [
    ['recordType', 'name', 'semesterNumber', 'year', 'sgpa', 'cgpa', 'credits', 'title', 'date', 'scorePercent', 'classAveragePercent', 'weight', 'status', 'type'],
    ...data.semesters.map((semester) => [
      'semester', semester.name, semester.semesterNumber, semester.year, semester.sgpa, semester.cgpa, semester.credits,
      '', '', '', '', '', '', '',
    ]),
    ...data.assignments.map((assignment) => [
      'assignment', '', '', '', '', '', '', assignment.title, assignment.isoDate,
      assignment.scorePercent, assignment.classAveragePercent, assignment.weight, assignment.status, assignment.type,
    ]),
  ];
  res.type('text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="performance-trend.csv"');
  return res.send(rows.map((row) => row.map(csvCell).join(',')).join('\r\n'));
}));

router.get('/students/:id/performance-trend', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty', 'advisor'].includes(req.user.role)) {
    throw new PerformanceError(403, 'You do not have permission to view this student.');
  }
  const query = performanceQuerySchema.parse(req.query);
  const student = await findStudent(req.params.id);
  assertStudentAccess(req.user, student);
  const semesters = await Semester.find({ studentId: student._id }).select('_id').lean();
  const allowedCourseIds = await assertFacultyCourses(
    req.user,
    student,
    semesters.map((semester) => semester._id),
    query.courseId
  );
  return sendSuccess(res, 'Performance trend loaded.', await getPerformanceTrend(student, {
    ...query,
    allowedCourseIds: allowedCourseIds || undefined,
  }));
}));

router.get('/students/me/semesters', asyncHandler(async (req, res) => {
  const query = listQuerySchema.pick({ page: true, limit: true }).parse(req.query);
  const student = await getOwnedStudent(req.user);
  return sendSuccess(res, 'Semesters loaded.', await listStudentSemesters(student._id, query));
}));

router.post('/semesters', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty'].includes(req.user.role)) throw new PerformanceError(403, 'You do not have permission to manage semesters.');
  const input = semesterInputSchema.parse(req.body);
  const student = await studentForSemesterInput(input, req.user);
  const data = await saveSemesterWithEnrollments(student._id, input);
  return sendSuccess(res, 'Semester created.', data, 201);
}));

router.patch('/semesters/:id', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty'].includes(req.user.role)) throw new PerformanceError(403, 'You do not have permission to manage semesters.');
  const id = objectId.parse(req.params.id);
  const input = semesterPatchSchema.parse(req.body);
  const semester = await Semester.findById(id);
  if (!semester) throw new PerformanceError(404, 'Semester not found.');
  await assertFacultyCanManageSemester(
    req.user,
    semester,
    (input.enrollments || []).map((enrollment) => enrollment.courseId)
  );
  const data = await saveSemesterWithEnrollments(semester.studentId, input, semester);
  return sendSuccess(res, 'Semester updated.', data);
}));

router.post('/semesters/:id/recompute', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty'].includes(req.user.role)) throw new PerformanceError(403, 'You do not have permission to recompute semesters.');
  const id = objectId.parse(req.params.id);
  const semester = await Semester.findById(id);
  if (!semester) throw new PerformanceError(404, 'Semester not found.');
  await assertFacultyCanManageSemester(req.user, semester);
  return sendSuccess(res, 'Semester GPA recomputed.', await recomputeStudentSemesters(semester.studentId));
}));

router.get('/students/me/assignments', asyncHandler(async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  const student = await getOwnedStudent(req.user);
  return sendSuccess(res, 'Assignments loaded.', await listStudentAssignments(student._id, query));
}));

router.post('/assignments', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty'].includes(req.user.role)) throw new PerformanceError(403, 'You do not have permission to create assignments.');
  const input = assignmentInputSchema.parse(req.body);
  const [course, semester] = await Promise.all([
    findCourse(input.courseId),
    Semester.findById(input.semesterId),
  ]);
  if (!semester) throw new PerformanceError(404, 'Semester not found.');
  if (!canManageCourse(req.user, course)) throw new PerformanceError(403, 'You may only manage assignments for your courses.');
  const isEnrolled = await CourseEnrollment.exists({
    studentId: semester.studentId,
    semesterId: semester._id,
    courseId: course._id,
  });
  if (!isEnrolled) throw new PerformanceError(400, 'The course is not enrolled in this semester.');
  const student = await Student.findById(semester.studentId).select('cohortId').lean();
  const assignment = await Assignment.create({
    id: `perf-${new mongoose.Types.ObjectId().toString()}`,
    title: input.title,
    courseCode: course.code,
    courseId: course._id,
    semesterId: semester._id,
    type: input.type,
    dueDate: input.dueDate.toISOString(),
    maxScore: input.maxScore,
    maxMarks: input.maxScore,
    weightPercent: input.weightPercent,
    cohortId: input.cohortId || student?.cohortId || '',
    status: 'Pending',
  });
  invalidatePerformanceCache();
  return sendSuccess(res, 'Assignment created.', assignment, 201);
}));

router.patch('/assignments/:id', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty'].includes(req.user.role)) throw new PerformanceError(403, 'You do not have permission to update assignments.');
  const id = objectId.parse(req.params.id);
  const input = assignmentPatchSchema.parse(req.body);
  const assignment = await Assignment.findById(id);
  if (!assignment) throw new PerformanceError(404, 'Assignment not found.');
  await assertFacultyAssignment(req.user, assignment);
  if (input.courseId) {
    const course = await findCourse(input.courseId);
    if (!canManageCourse(req.user, course)) throw new PerformanceError(403, 'You may only manage assignments for your courses.');
    assignment.courseId = course._id;
    assignment.courseCode = course.code;
  }
  if (input.semesterId) {
    const semester = await Semester.findById(input.semesterId);
    if (!semester) throw new PerformanceError(404, 'Semester not found.');
    assignment.semesterId = semester._id;
  }
  if (input.courseId || input.semesterId) {
    const targetSemester = await Semester.findById(assignment.semesterId);
    if (!targetSemester) throw new PerformanceError(404, 'Semester not found.');
    const isEnrolled = await CourseEnrollment.exists({
      studentId: targetSemester.studentId,
      semesterId: assignment.semesterId,
      courseId: assignment.courseId,
    });
    if (!isEnrolled) throw new PerformanceError(400, 'The course is not enrolled in this semester.');
  }
  if (input.title !== undefined) assignment.title = input.title;
  if (input.type !== undefined) assignment.type = input.type;
  if (input.dueDate !== undefined) assignment.dueDate = input.dueDate.toISOString();
  if (input.maxScore !== undefined) {
    assignment.maxScore = input.maxScore;
    assignment.maxMarks = input.maxScore;
  }
  if (input.weightPercent !== undefined) assignment.weightPercent = input.weightPercent;
  if (input.cohortId !== undefined) assignment.cohortId = input.cohortId;
  await assignment.save();
  invalidatePerformanceCache();
  return sendSuccess(res, 'Assignment updated.', assignment);
}));

router.post('/assignments/:id/submissions', asyncHandler(async (req, res) => {
  if (req.user.role !== 'student') throw new PerformanceError(403, 'Only students can submit assignments.');
  const id = objectId.parse(req.params.id);
  submissionInputSchema.parse(req.body || {});
  const [assignment, student] = await Promise.all([
    Assignment.findById(id),
    getOwnedStudent(req.user),
  ]);
  if (!assignment) throw new PerformanceError(404, 'Assignment not found.');
  const isEnrolled = await CourseEnrollment.exists({
    studentId: student._id,
    semesterId: assignment.semesterId,
    courseId: assignment.courseId,
  });
  if (!isEnrolled) throw new PerformanceError(403, 'You are not enrolled in this assignment course.');
  const existingSubmission = await Submission.findOne({
    assignmentId: assignment._id,
    studentId: student._id,
  });
  if (existingSubmission?.status === 'graded') {
    throw new PerformanceError(409, 'This submission has already been graded.');
  }
  const submittedAt = new Date();
  const isLate = assignment.dueDate && submittedAt.getTime() > new Date(assignment.dueDate).getTime();
  const submission = await Submission.findOneAndUpdate(
    { assignmentId: assignment._id, studentId: student._id },
    {
      $set: {
        submittedAt,
        submittedOnTime: !isLate,
        status: isLate ? 'late' : 'submitted',
        score: null,
        scorePercent: null,
        gradedAt: null,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  await recomputeAssignmentStats(assignment._id);
  invalidatePerformanceCache();
  return sendSuccess(res, 'Submission recorded.', submission, 201);
}));

router.patch('/submissions/:id/grade', asyncHandler(async (req, res) => {
  if (!['admin', 'faculty'].includes(req.user.role)) throw new PerformanceError(403, 'You do not have permission to grade submissions.');
  const id = objectId.parse(req.params.id);
  const { score } = gradeInputSchema.parse(req.body);
  const submission = await Submission.findById(id);
  if (!submission) throw new PerformanceError(404, 'Submission not found.');
  const assignment = await Assignment.findById(submission.assignmentId);
  if (!assignment) throw new PerformanceError(404, 'Assignment not found.');
  await assertFacultyAssignment(req.user, assignment);
  const maxScore = Number(assignment.maxScore ?? assignment.maxMarks);
  if (score > maxScore) throw new PerformanceError(400, 'Score cannot exceed the assignment maximum.');
  submission.score = score;
  submission.scorePercent = maxScore > 0 ? (score / maxScore) * 100 : null;
  submission.status = 'graded';
  submission.gradedAt = new Date();
  await submission.save();
  return sendSuccess(res, 'Submission graded.', submission);
}));

router.get('/settings/academic', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new PerformanceError(403, 'Only admins can view academic settings.');
  const { programId = 'default' } = academicSettingsQuerySchema.parse(req.query);
  return sendSuccess(res, 'Academic settings loaded.', await getAcademicSettings(programId));
}));

router.put('/settings/academic', asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw new PerformanceError(403, 'Only admins can update academic settings.');
  const { programId = 'default', ...input } = academicSettingsSchema.parse(req.body);
  const settings = await AcademicSettings.findOneAndUpdate(
    { programId },
    { $set: input, $setOnInsert: { programId } },
    { upsert: true, new: true, runValidators: true }
  );
  invalidatePerformanceCache();
  return sendSuccess(res, 'Academic settings updated.', settings);
}));

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: error.issues[0]?.message || 'The request is invalid.',
      data: { issues: error.issues },
    });
  }
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(`[Performance API] ${req.method} ${req.path} failed.`);
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'The performance request could not be completed.' : error.message,
    data: null,
  });
});

export default router;
