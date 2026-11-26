import mongoose from 'mongoose';
import {
  Assignment,
  AuditLog,
  Course,
  CourseEnrollment,
  CourseFaculty,
  Notification,
  Reminder,
  Student,
  StudentAssignmentState,
  Submission,
  User,
} from '../models.js';
import {
  getStudentForUser,
  invalidatePerformanceCache,
} from './performanceService.js';
import { assignmentStatusStages } from './assignmentStatus.js';

const publishedOrLegacy = { lifecycleStatus: { $in: ['published', null] } };
const notDeleted = { deletedAt: null };
const activeSubmissionStatuses = ['submitted', 'late', 'graded'];

export class AssignmentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function userId(user) {
  return String(user.id || user._id);
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

function sanitizeDescription(value = '') {
  return String(value)
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAuditValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(cleanAuditValue);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(storageKey|password|token|secret|private.?key)/i.test(key))
      .map(([key, child]) => [key, cleanAuditValue(child)])
  );
}

function assignmentAuditSnapshot(assignment) {
  return cleanAuditValue({
    id: assignment.id,
    title: assignment.title,
    courseId: assignment.courseId,
    courseCode: assignment.courseCode,
    source: assignment.source,
    ownerStudentId: assignment.ownerStudentId,
    createdBy: assignment.createdBy,
    dueDate: assignment.dueDate,
    weightPercent: assignment.weightPercent,
    maxMarks: assignment.maxMarks,
    maxScore: assignment.maxScore,
    type: assignment.type,
    lifecycleStatus: assignment.lifecycleStatus,
    deletedAt: assignment.deletedAt,
  });
}

export async function writeAudit(req, assignment, action, before, after, entityId = assignment._id) {
  const course = assignment.courseId ? await Course.findById(assignment.courseId).select('institutionId').lean() : null;
  const institutionId = assignment.institutionId || course?.institutionId || req.user.institutionId;
  if (!institutionId) throw new AssignmentError(409, 'This assignment is missing its institution association.');
  await AuditLog.create({
    institutionId,
    actorId: userId(req.user),
    action,
    entityType: action.startsWith('submission.')
      ? 'Submission'
      : action.startsWith('assignment.completion.')
        ? 'StudentAssignmentState'
        : 'Assignment',
    entityId: String(entityId),
    before: cleanAuditValue(before),
    after: cleanAuditValue(after),
    ip: String(req.ip || '').slice(0, 64),
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
  });
}

async function findCourse(identifier) {
  const course = mongoose.isValidObjectId(identifier)
    ? await Course.findById(identifier)
    : await Course.findOne({ code: String(identifier).trim().toUpperCase() });
  if (!course) throw new AssignmentError(404, 'Course not found.');
  return course;
}

function assertSameInstitution(user, course) {
  if (user.institutionId && !sameId(user.institutionId, course.institutionId)) {
    throw new AssignmentError(403, 'You do not have access to this course.');
  }
}

async function getFacultyDocument(user) {
  return User.findOne({ id: userId(user) }).select('_id id').lean();
}

export async function canManageCourse(user, course) {
  assertSameInstitution(user, course);
  if (user.role === 'admin') return true;
  if (user.role !== 'faculty') return false;
  if (sameId(course.facultyUserId, userId(user))) return true;
  if (String(course.facultyName || '').toLowerCase() === String(user.name || '').toLowerCase()) return true;
  const faculty = await getFacultyDocument(user);
  if (!faculty) return false;
  return Boolean(await CourseFaculty.exists({
    courseId: course._id,
    facultyId: faculty._id,
    active: true,
  }));
}

async function facultyCourseIds(user) {
  const faculty = await getFacultyDocument(user);
  const ids = faculty
    ? await CourseFaculty.find({ facultyId: faculty._id, active: true }).distinct('courseId')
    : [];
  const legacyCourses = await Course.find({
    $or: [
      { facultyUserId: userId(user) },
      { facultyName: new RegExp(`^${String(user.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
    ...(user.institutionId ? { institutionId: user.institutionId } : {}),
  }).distinct('_id');
  const requestedIds = [...new Map([...ids, ...legacyCourses].map((id) => [String(id), id])).values()];
  return Course.find({
    _id: { $in: requestedIds },
    ...(user.institutionId ? { institutionId: user.institutionId } : {}),
  }).distinct('_id');
}

async function studentForUser(user) {
  if (user.role !== 'student') throw new AssignmentError(403, 'Student access is required.');
  return getStudentForUser(user);
}

async function studentCourseIds(studentId, user) {
  const enrolledCourseIds = await CourseEnrollment.find({ studentId }).distinct('courseId');
  if (!user.institutionId) return enrolledCourseIds;
  return Course.find({
    _id: { $in: enrolledCourseIds },
    institutionId: user.institutionId,
  }).distinct('_id');
}

async function assignmentScope(user) {
  if (user.role === 'student') {
    const student = await studentForUser(user);
    const courseIds = await studentCourseIds(student._id, user);
    return {
      student,
      filter: {
        $and: [
          notDeleted,
          publishedOrLegacy,
          {
            $or: [
              { source: 'personal', ownerStudentId: student._id },
              { source: { $in: ['faculty', null] }, courseId: { $in: courseIds } },
            ],
          },
        ],
      },
    };
  }
  if (user.role === 'faculty') {
    const courseIds = await facultyCourseIds(user);
    return {
      student: null,
      filter: {
        $and: [
          notDeleted,
          publishedOrLegacy,
          { source: { $in: ['faculty', null] }, courseId: { $in: courseIds } },
        ],
      },
    };
  }
  if (user.role === 'admin' && user.institutionId) {
    const courseIds = await Course.find({ institutionId: user.institutionId }).distinct('_id');
    return {
      student: null,
      filter: {
        $and: [
          notDeleted,
          publishedOrLegacy,
          { courseId: { $in: courseIds } },
          { source: { $in: ['faculty', null] } },
        ],
      },
    };
  }
  throw new AssignmentError(403, 'You do not have permission to access assignments.');
}

function isOwnedPersonalAssignment(user, student, assignment) {
  return user.role === 'student'
    && assignment.source === 'personal'
    && sameId(assignment.ownerStudentId, student?._id);
}

async function assertCanReadAssignment(user, assignment) {
  if (user.role === 'student') {
    const student = await studentForUser(user);
    if (isOwnedPersonalAssignment(user, student, assignment)) return student;
    const course = await Course.findById(assignment.courseId).select('institutionId').lean();
    if (!course || (user.institutionId && !sameId(user.institutionId, course.institutionId))) {
      throw new AssignmentError(404, 'Assignment not found.');
    }
    const enrolled = await CourseEnrollment.exists({
      studentId: student._id,
      courseId: assignment.courseId,
    });
    if (assignment.source === 'faculty' || !assignment.source) {
      if (enrolled) return student;
    }
    throw new AssignmentError(404, 'Assignment not found.');
  }
  if (assignment.source === 'personal') {
    throw new AssignmentError(404, 'Assignment not found.');
  }
  const course = await Course.findById(assignment.courseId);
  if (!course || !(await canManageCourse(user, course))) {
    throw new AssignmentError(404, 'Assignment not found.');
  }
  return null;
}

async function assertCanEditAssignment(user, assignment) {
  if (user.role === 'student') {
    const student = await studentForUser(user);
    if (!isOwnedPersonalAssignment(user, student, assignment)) {
      throw new AssignmentError(403, 'Students may edit only their own personal assignments.');
    }
    return student;
  }
  if (user.role === 'faculty') {
    if (assignment.source !== 'faculty' || !sameId(assignment.createdBy, userId(user))) {
      throw new AssignmentError(403, 'Faculty may edit only assignments they created.');
    }
    const course = await Course.findById(assignment.courseId);
    if (!course || !(await canManageCourse(user, course))) {
      throw new AssignmentError(403, 'You may only manage assignments for your courses.');
    }
    return null;
  }
  if (user.role === 'admin' && assignment.source !== 'personal' && user.institutionId
    && sameId(assignment.institutionId, user.institutionId)) return null;
  throw new AssignmentError(403, 'You do not have permission to edit this assignment.');
}

function assignmentIsPublished(assignment) {
  return !assignment.lifecycleStatus || assignment.lifecycleStatus === 'published';
}

function serializeAssignment(row, user, student) {
  const assignment = row;
  const submission = assignment.studentSubmission || null;
  const files = submission?.files || [];
  const latestFile = files.at(-1);
  const source = assignment.source || 'faculty';
  const status = assignment.status;
  const canEdit = isOwnedPersonalAssignment(user, student, assignment)
    || (user.role === 'faculty'
      && source === 'faculty'
      && sameId(assignment.createdBy, userId(user)))
    || (user.role === 'admin'
      && sameId(assignment.institutionId, user.institutionId));
  const isGraded = submission?.status === 'graded';
  const isWithinDeadline = assignment.dueDate && new Date(assignment.dueDate).getTime() >= Date.now();
  const canSubmit = user.role === 'student'
    && source === 'faculty'
    && assignmentIsPublished(assignment)
    && !isGraded
    && (isWithinDeadline || Boolean(assignment.allowLateSubmission));

  return {
    id: String(assignment._id),
    title: assignment.title,
    courseId: String(assignment.courseId),
    courseCode: assignment.course?.code || assignment.courseCode,
    courseName: assignment.course?.name || '',
    description: assignment.description || '',
    weightPercent: assignment.weightPercent,
    maxMarks: assignment.maxMarks ?? assignment.maxScore,
    dueDate: assignment.dueDate?.toISOString?.() || null,
    status,
    isDueSoon: Boolean(assignment.isDueSoon),
    dueInSeconds: assignment.dueInSeconds,
    source,
    canEdit,
    canSubmit,
    allowLateSubmission: Boolean(assignment.allowLateSubmission),
    latePenaltyPercent: Number(assignment.latePenaltyPercent) || 0,
    submission: submission ? {
      id: String(submission._id),
      submittedAt: submission.submittedAt?.toISOString?.() || null,
      fileName: latestFile?.originalName || '',
      fileSize: files.reduce((total, file) => total + (Number(file.size) || 0), 0),
      downloadUrl: files.length ? `/api/v1/submissions/${submission._id}/download` : null,
      isLate: Boolean(submission.isLate || submission.status === 'late'),
      status: submission.status,
      version: submission.version || 1,
    } : null,
    obtainedMarks: submission?.obtainedMarks ?? submission?.score ?? undefined,
    feedback: submission?.feedback || undefined,
    gradedAt: submission?.gradedAt?.toISOString?.() || undefined,
    createdAt: assignment.createdAt?.toISOString?.() || undefined,
  };
}

export async function listAssignments(user, query) {
  const scope = await assignmentScope(user);
  const studentId = scope.student?._id || null;
  const statusMatch = query.status === 'DueSoon'
    ? { isDueSoon: true }
    : query.status === 'All'
      ? null
      : { status: query.status };
  const courseMatch = query.courseCode
    ? { 'course.code': query.courseCode.toUpperCase() }
    : null;
  const matches = [courseMatch, statusMatch].filter(Boolean);
  const sortField = query.sortBy === 'weight' ? 'weightPercent' : 'dueDate';
  const direction = query.order === 'desc' ? -1 : 1;
  const [result] = await Assignment.aggregate([
    { $match: scope.filter },
    ...assignmentStatusStages(studentId),
    ...(matches.length ? [{ $match: { $and: matches } }] : []),
    {
      $facet: {
        items: [
          { $sort: { [sortField]: direction, _id: 1 } },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        metadata: [{ $count: 'total' }],
      },
    },
  ]);
  const items = (result?.items || []).map((row) => serializeAssignment(row, user, scope.student));
  const total = result?.metadata?.[0]?.total || 0;
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}

export async function getAssignmentStats(user) {
  const scope = await assignmentScope(user);
  const studentId = scope.student?._id || null;
  const [result] = await Assignment.aggregate([
    { $match: scope.filter },
    ...assignmentStatusStages(studentId),
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalCount: { $sum: 1 },
              completedCount: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
              overdueCount: { $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] } },
              upcomingCount: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
              dueSoonCount: { $sum: { $cond: ['$isDueSoon', 1, 0] } },
            },
          },
          {
            $project: {
              _id: 0,
              totalCount: 1,
              completedCount: 1,
              overdueCount: 1,
              upcomingCount: 1,
              dueSoonCount: 1,
              completionRate: {
                $cond: [
                  { $gt: ['$totalCount', 0] },
                  { $round: [{ $multiply: [{ $divide: ['$completedCount', '$totalCount'] }, 100] }, 0] },
                  0,
                ],
              },
            },
          },
        ],
        perCourse: [
          {
            $group: {
              _id: { $ifNull: ['$course.code', '$courseCode'] },
              courseName: { $first: { $ifNull: ['$course.name', ''] } },
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              courseCode: '$_id',
              courseName: 1,
              total: 1,
              completed: 1,
            },
          },
        ],
      },
    },
  ]);
  return {
    totalCount: result?.totals?.[0]?.totalCount || 0,
    completedCount: result?.totals?.[0]?.completedCount || 0,
    overdueCount: result?.totals?.[0]?.overdueCount || 0,
    upcomingCount: result?.totals?.[0]?.upcomingCount || 0,
    dueSoonCount: result?.totals?.[0]?.dueSoonCount || 0,
    completionRate: result?.totals?.[0]?.completionRate || 0,
    perCourse: result?.perCourse || [],
  };
}

export async function getAssignmentDetails(user, identifier) {
  const scope = await assignmentScope(user);
  const assignmentId = new mongoose.Types.ObjectId(identifier);
  const [row] = await Assignment.aggregate([
    { $match: { $and: [scope.filter, { _id: assignmentId }] } },
    ...assignmentStatusStages(scope.student?._id || null),
    { $limit: 1 },
  ]);
  if (!row) throw new AssignmentError(404, 'Assignment not found.');
  return serializeAssignment(row, user, scope.student);
}

export async function listMyCourses(user) {
  let courseIds = [];
  if (user.role === 'student') {
    const student = await studentForUser(user);
    courseIds = await studentCourseIds(student._id, user);
  } else if (user.role === 'faculty') {
    courseIds = await facultyCourseIds(user);
  } else if (user.role === 'admin' && user.institutionId) {
    return Course.find({ institutionId: user.institutionId })
      .select('_id code name')
      .sort({ code: 1 })
      .lean();
  } else {
    throw new AssignmentError(403, 'You do not have permission to view course assignments.');
  }
  return Course.find({ _id: { $in: courseIds } })
    .select('_id code name')
    .sort({ code: 1 })
    .lean();
}

export async function createAssignment(user, input, req) {
  if (!['student', 'faculty'].includes(user.role)) {
    throw new AssignmentError(403, 'Only students and faculty can create assignments.');
  }
  const course = await findCourse(input.courseId);
  assertSameInstitution(user, course);
  const student = user.role === 'student' ? await studentForUser(user) : null;
  if (student) {
    const enrolled = await CourseEnrollment.exists({ studentId: student._id, courseId: course._id });
    if (!enrolled) throw new AssignmentError(403, 'You may create a personal assignment only for an enrolled course.');
  } else if (!(await canManageCourse(user, course))) {
    throw new AssignmentError(403, 'You may create a faculty assignment only for a course you teach.');
  }

  const dueDate = req.assignmentDueDate;
  if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime()) || dueDate.getTime() < Date.now()) {
    throw new AssignmentError(400, 'The due date must be today or in the future.');
  }
  const assignment = await Assignment.create({
    id: `asg-${new mongoose.Types.ObjectId().toString()}`,
    institutionId: course.institutionId || user.institutionId,
    courseId: course._id,
    courseCode: course.code,
    title: input.title,
    description: sanitizeDescription(input.description),
    weightPercent: input.weightPercent,
    maxMarks: input.maxMarks,
    maxScore: input.maxMarks,
    dueDate,
    source: student ? 'personal' : 'faculty',
    ownerStudentId: student?._id || null,
    createdBy: userId(user),
    lifecycleStatus: 'published',
    allowLateSubmission: input.allowLateSubmission,
    latePenaltyPercent: input.latePenaltyPercent,
    allowedFileTypes: input.allowedFileTypes,
    maxFileSizeMB: input.maxFileSizeMB,
    status: 'Pending',
  });
  await writeAudit(req, assignment, 'assignment.created', null, assignmentAuditSnapshot(assignment));
  invalidatePerformanceCache();
  if (assignment.source === 'faculty') await notifyEnrolledStudents(course, assignment);
  return getAssignmentDetails(user, String(assignment._id));
}

export async function updateAssignment(user, assignment, input, req) {
  await assertCanEditAssignment(user, assignment);
  const before = assignmentAuditSnapshot(assignment);
  const oldDueDate = assignment.dueDate ? new Date(assignment.dueDate).getTime() : null;
  const nextMaxMarks = input.maxMarks ?? input.maxScore;
  if (
    nextMaxMarks !== undefined
    && Number(nextMaxMarks) !== Number(assignment.maxMarks ?? assignment.maxScore)
    && await Submission.exists({ assignmentId: assignment._id, status: 'graded' })
  ) {
    throw new AssignmentError(409, 'Maximum marks cannot change after submissions have been graded.');
  }
  const fields = [
    'title',
    'weightPercent',
    'maxMarks',
    'type',
    'maxScore',
    'cohortId',
    'allowLateSubmission',
    'latePenaltyPercent',
    'allowedFileTypes',
    'maxFileSizeMB',
  ];
  for (const field of fields) {
    if (input[field] !== undefined) assignment[field] = input[field];
  }
  if (input.maxScore !== undefined) assignment.maxMarks = input.maxScore;
  if (input.description !== undefined) assignment.description = sanitizeDescription(input.description);
  if (req.assignmentDueDate) assignment.dueDate = req.assignmentDueDate;
  assignment.maxScore = assignment.maxMarks;
  await assignment.save();
  await writeAudit(req, assignment, 'assignment.updated', before, assignmentAuditSnapshot(assignment));
  invalidatePerformanceCache();

  if (
    assignment.source === 'faculty'
    && req.assignmentDueDate
    && req.assignmentDueDate.getTime() !== oldDueDate
  ) {
    await Reminder.deleteMany({ assignmentId: assignment._id });
    await notifyEnrolledStudents(await Course.findById(assignment.courseId), assignment, true);
  }
  return getAssignmentDetails(user, String(assignment._id));
}

export async function deleteAssignment(user, assignment, req) {
  await assertCanEditAssignment(user, assignment);
  const before = assignmentAuditSnapshot(assignment);
  if (assignment.source === 'faculty') {
    const gradedSubmission = await Submission.exists({
      assignmentId: assignment._id,
      status: 'graded',
    });
    if (gradedSubmission) {
      throw new AssignmentError(409, 'A faculty assignment with graded submissions cannot be deleted.');
    }
  }
  assignment.lifecycleStatus = 'archived';
  assignment.deletedAt = new Date();
  await assignment.save();
  await writeAudit(req, assignment, 'assignment.deleted', before, assignmentAuditSnapshot(assignment));
  invalidatePerformanceCache();
  await Reminder.deleteMany({ assignmentId: assignment._id });
  return { id: String(assignment._id), deleted: true };
}

function activeSubmission(submission) {
  return submission && activeSubmissionStatuses.includes(submission.status);
}

function submissionHistorySnapshot(submission) {
  return {
    version: submission.version || 1,
    files: (submission.files || []).map((file) => ({
      originalName: file.originalName,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      size: file.size,
      sha256: file.sha256,
    })),
    note: submission.note || '',
    submittedAt: submission.submittedAt,
    isLate: Boolean(submission.isLate),
    status: submission.status,
    obtainedMarks: submission.obtainedMarks ?? submission.score ?? null,
    feedback: submission.feedback || '',
    gradedAt: submission.gradedAt || null,
  };
}

export async function toggleAssignmentCompletion(user, assignment, completed, req) {
  if (user.role !== 'student') throw new AssignmentError(403, 'Only students can update assignment completion.');
  const student = await studentForUser(user);
  if (assignment.source === 'personal' && sameId(assignment.ownerStudentId, student._id)) {
    const existing = await StudentAssignmentState.findOne({
      assignmentId: assignment._id,
      studentId: student._id,
    }).lean();
    const state = await StudentAssignmentState.findOneAndUpdate(
      { assignmentId: assignment._id, studentId: student._id },
      {
        $set: {
          manualCompleted: completed,
          completedAt: completed ? new Date() : null,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    await writeAudit(
      req,
      assignment,
      'assignment.completion.updated',
      { manualCompleted: Boolean(existing?.manualCompleted) },
      { manualCompleted: state.manualCompleted, completedAt: state.completedAt },
      state._id
    );
    return getAssignmentDetails(user, String(assignment._id));
  }

  if (completed) {
    throw new AssignmentError(400, 'Submit a file to complete a faculty assignment.');
  }
  const submission = await Submission.findOne({
    assignmentId: assignment._id,
    studentId: student._id,
  });
  if (!submission || !activeSubmission(submission)) {
    return getAssignmentDetails(user, String(assignment._id));
  }
  if (submission.status === 'graded' || submission.gradedAt) {
    throw new AssignmentError(409, 'A graded submission cannot be withdrawn.');
  }
  if (!assignment.dueDate || Date.now() >= new Date(assignment.dueDate).getTime()) {
    throw new AssignmentError(409, 'A submission can be withdrawn only before the due date.');
  }
  const before = submissionHistorySnapshot(submission);
  submission.history.push(before);
  submission.version = (submission.version || 1) + 1;
  submission.files = [];
  submission.note = '';
  submission.status = 'withdrawn';
  submission.withdrawnAt = new Date();
  submission.submittedAt = null;
  submission.isLate = false;
  submission.submittedOnTime = null;
  await submission.save();
  await writeAudit(req, assignment, 'submission.withdrawn', before, {
    assignmentId: assignment._id,
    studentId: student._id,
    version: submission.version,
    status: submission.status,
  }, submission._id);
  return getAssignmentDetails(user, String(assignment._id));
}

async function notifyEnrolledStudents(course, assignment, dueDateChanged = false) {
  if (!course) return;
  const studentIds = await CourseEnrollment.find({ courseId: course._id }).distinct('studentId');
  if (!studentIds.length) return;
  const students = await Student.find({ _id: { $in: studentIds } }).select('userId').lean();
  const userIds = students.map((student) => student.userId).filter(Boolean);
  const users = await User.find({
    id: { $in: userIds },
    'notificationPreferences.assignments': { $ne: false },
  }).select('id').lean();
  if (!users.length) return;
  await Notification.insertMany(users.map((user) => ({
    userId: user.id,
    title: dueDateChanged ? 'Assignment deadline updated' : 'New course assignment',
    message: dueDateChanged
      ? `${assignment.title} now has an updated deadline.`
      : `${assignment.title} was added to ${course.code}.`,
    category: 'assignment',
    relatedAssignmentId: assignment._id,
  })));
}

export async function submitAssignment(user, assignment, student, file, validatedFile, sha256, note, req) {
  if (assignment.source !== 'faculty') {
    throw new AssignmentError(403, 'Only faculty assignments accept file submissions.');
  }
  const submittedAt = new Date();
  const isLate = submittedAt.getTime() > new Date(assignment.dueDate).getTime();
  if (isLate && !assignment.allowLateSubmission) {
    throw new AssignmentError(409, 'The deadline has passed and late submissions are disabled.');
  }
  let submission = await Submission.findOne({
    assignmentId: assignment._id,
    studentId: student._id,
  });
  if (submission?.status === 'graded' || submission?.gradedAt) {
    throw new AssignmentError(409, 'A graded submission is locked.');
  }
  if (
    submission
    && submittedAt.getTime() - new Date(submission.submittedAt || 0).getTime() <= 60 * 1000
    && submission.files?.some((existingFile) => existingFile.sha256 === sha256)
  ) {
    return getAssignmentDetails(user, String(assignment._id));
  }

  const storageKey = await req.promoteAssignmentFile(assignment, student, sha256, validatedFile.extension);
  const before = submission ? submissionHistorySnapshot(submission) : null;
  if (!submission) {
    submission = new Submission({
      assignmentId: assignment._id,
      studentId: student._id,
    });
  } else if (submission.version > 0 && (submission.files?.length || submission.submittedAt)) {
    submission.history.push(submissionHistorySnapshot(submission));
  }
  submission.version = (submission.version || 0) + 1;
  submission.files = [{
    originalName: validatedFile.originalName,
    storageKey,
    mimeType: validatedFile.mimeType,
    size: file.size,
    sha256,
  }];
  submission.note = note;
  submission.submittedAt = submittedAt;
  submission.isLate = isLate;
  submission.submittedOnTime = !isLate;
  submission.status = isLate ? 'late' : 'submitted';
  submission.score = null;
  submission.scorePercent = null;
  submission.obtainedMarks = null;
  submission.feedback = '';
  submission.gradedBy = '';
  submission.gradedAt = null;
  submission.withdrawnAt = null;
  await submission.save();
  await writeAudit(req, assignment, 'submission.created', before, {
    assignmentId: assignment._id,
    studentId: student._id,
    fileName: validatedFile.originalName,
    fileSize: file.size,
    sha256,
    isLate,
    version: submission.version,
  }, submission._id);
  return getAssignmentDetails(user, String(assignment._id));
}

export async function gradeAssignment(user, submission, input, req) {
  if (!['faculty', 'admin'].includes(user.role)) {
    throw new AssignmentError(403, 'Only faculty can grade submissions.');
  }
  const assignment = await Assignment.findById(submission.assignmentId);
  if (!assignment) throw new AssignmentError(404, 'Assignment not found.');
  if (assignment.source === 'personal') {
    throw new AssignmentError(403, 'Personal assignments cannot be graded by faculty.');
  }
  const course = await Course.findById(assignment.courseId);
  if (!course || !(await canManageCourse(user, course))) {
    throw new AssignmentError(403, 'You may only grade submissions for courses you teach.');
  }
  if (!activeSubmission(submission)) {
    throw new AssignmentError(409, 'Only active submissions can be graded.');
  }
  const maxMarks = Number(assignment.maxMarks ?? assignment.maxScore);
  if (input.obtainedMarks > maxMarks) {
    throw new AssignmentError(400, 'Obtained marks cannot exceed the assignment maximum.');
  }
  const before = {
    status: submission.status,
    obtainedMarks: submission.obtainedMarks ?? submission.score,
    feedback: submission.feedback,
    gradedAt: submission.gradedAt,
  };
  const appliedPenalty = submission.isLate ? Number(assignment.latePenaltyPercent) || 0 : 0;
  const finalMarks = Number((input.obtainedMarks * (1 - appliedPenalty / 100)).toFixed(2));
  submission.obtainedMarks = finalMarks;
  submission.score = finalMarks;
  submission.scorePercent = maxMarks > 0 ? (finalMarks / maxMarks) * 100 : null;
  submission.feedback = input.feedback;
  submission.gradedBy = userId(user);
  submission.status = 'graded';
  submission.gradedAt = new Date();
  await submission.save();
  await writeAudit(req, assignment, 'submission.graded', before, {
    status: submission.status,
    obtainedMarks: finalMarks,
    latePenaltyPercent: appliedPenalty,
    feedback: submission.feedback,
    gradedAt: submission.gradedAt,
  }, submission._id);
  const student = await Student.findById(submission.studentId).select('userId').lean();
  if (student?.userId) {
    await Notification.create({
      userId: student.userId,
      title: 'Assignment graded',
      message: `${assignment.title} has been graded. Open the assignment details to see your feedback.`,
      category: 'grade',
      relatedAssignmentId: assignment._id,
    });
  }
  return {
    id: String(submission._id),
    assignmentId: String(assignment._id),
    status: submission.status,
    obtainedMarks: finalMarks,
    maxMarks,
    feedback: submission.feedback,
    gradedAt: submission.gradedAt,
    isLate: submission.isLate,
  };
}

export async function listCourseAssignmentSubmissions(user, courseIdentifier, assignmentIdentifier, query) {
  if (!['faculty', 'admin'].includes(user.role)) {
    throw new AssignmentError(403, 'Only faculty can view course submissions.');
  }
  const course = await findCourse(courseIdentifier);
  if (!(await canManageCourse(user, course))) {
    throw new AssignmentError(403, 'You may only view submissions for courses you teach.');
  }
  const assignment = await Assignment.findOne({
    _id: assignmentIdentifier,
    courseId: course._id,
    deletedAt: null,
  }).lean();
  if (!assignment || assignment.source !== 'faculty') {
    throw new AssignmentError(404, 'Assignment not found for this course.');
  }

  const studentIds = await CourseEnrollment.find({ courseId: course._id }).distinct('studentId');
  const [students, submissions] = await Promise.all([
    Student.find({ _id: { $in: studentIds } }).select('_id userId').lean(),
    Submission.find({ assignmentId: assignment._id }).lean(),
  ]);
  const userIds = students.map((student) => student.userId).filter(Boolean);
  const users = await User.find({ id: { $in: userIds } }).select('id name enrollmentNumber').lean();
  const userById = new Map(users.map((studentUser) => [studentUser.id, studentUser]));
  const submissionByStudent = new Map(submissions.map((submission) => [
    String(submission.studentId),
    submission,
  ]));
  const rows = students.map((student) => {
    const submission = submissionByStudent.get(String(student._id));
    const studentUser = userById.get(student.userId);
    return {
      studentId: String(student._id),
      name: studentUser?.name || '',
      enrollmentNumber: studentUser?.enrollmentNumber || '',
      status: submission?.status || 'pending',
      submittedAt: submission?.submittedAt || null,
      isLate: Boolean(submission?.isLate || submission?.status === 'late'),
      files: (submission?.files || []).map((file) => ({
        originalName: file.originalName,
        size: file.size,
        downloadUrl: `/api/v1/submissions/${submission._id}/download`,
      })),
      obtainedMarks: submission?.obtainedMarks ?? submission?.score ?? null,
      feedback: submission?.feedback || '',
      submissionId: submission ? String(submission._id) : null,
    };
  });
  const submittedCount = rows.filter((row) => activeSubmission({ status: row.status })).length;
  const gradedCount = rows.filter((row) => row.status === 'graded').length;
  const lateCount = rows.filter((row) => row.isLate).length;
  const start = (query.page - 1) * query.limit;
  return {
    items: rows.slice(start, start + query.limit),
    counts: {
      total: rows.length,
      submitted: submittedCount,
      missing: rows.length - submittedCount,
      late: lateCount,
      graded: gradedCount,
    },
    pagination: {
      page: query.page,
      limit: query.limit,
      total: rows.length,
      pages: Math.ceil(rows.length / query.limit),
    },
  };
}

export async function assignmentSubmissionForDownload(user, submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission || !submission.files?.length || !activeSubmission(submission)) {
    throw new AssignmentError(404, 'Submission file not found.');
  }
  const assignment = await Assignment.findById(submission.assignmentId);
  if (!assignment) throw new AssignmentError(404, 'Assignment not found.');

  if (user.role === 'student') {
    const student = await studentForUser(user);
    if (!sameId(student._id, submission.studentId)) {
      throw new AssignmentError(404, 'Submission file not found.');
    }
    await assertCanReadAssignment(user, assignment);
  } else {
    if (assignment.source === 'personal') {
      throw new AssignmentError(404, 'Submission file not found.');
    }
    const course = await Course.findById(assignment.courseId);
    if (!course || !(await canManageCourse(user, course))) {
      throw new AssignmentError(404, 'Submission file not found.');
    }
  }
  const file = submission.files.at(-1);
  return { file, assignment, submission };
}

export async function createAssignmentReminder(assignment, student, type, now = new Date()) {
  try {
    await Reminder.create({
      assignmentId: assignment._id,
      studentId: student._id,
      type,
      sentAt: now,
    });
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
  const studentUser = await User.findOne({
    id: student.userId,
    'notificationPreferences.reminders': { $ne: false },
  }).select('id').lean();
  if (!studentUser) return true;
  const messageByType = {
    '24h': `${assignment.title} is due within 24 hours.`,
    '1h': `${assignment.title} is due within one hour.`,
    overdue: `${assignment.title} is overdue. Submit it as soon as possible.`,
  };
  await Notification.create({
    userId: studentUser.id,
    title: type === 'overdue' ? 'Assignment overdue' : 'Assignment reminder',
    message: messageByType[type],
    category: 'reminder',
    relatedAssignmentId: assignment._id,
  });
  return true;
}

export async function listUserNotifications(user, { page = 1, limit = 50, unreadOnly = false } = {}) {
  const filter = { userId: userId(user) };
  if (unreadOnly) filter.readAt = null;
  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);
  return {
    items: notifications.map((item) => ({
      id: String(item._id),
      title: item.title,
      message: item.message,
      category: item.category,
      read: Boolean(item.readAt),
      createdAt: item.createdAt,
      time: new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        -Math.max(0, Math.round((Date.now() - new Date(item.createdAt).getTime()) / 60000)),
        'minute'
      ),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function markNotificationRead(user, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId: userId(user) },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw new AssignmentError(404, 'Notification not found.');
  return { id: String(notification._id), read: true };
}

export async function markAllNotificationsRead(user) {
  const result = await Notification.updateMany(
    { userId: userId(user), readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { updatedCount: result.modifiedCount || 0 };
}

export async function deleteNotification(user, notificationId) {
  const result = await Notification.deleteOne({ _id: notificationId, userId: userId(user) });
  if (!result.deletedCount) throw new AssignmentError(404, 'Notification not found.');
  return { id: String(notificationId), deleted: true };
}

export async function getAssignmentByIdForUser(user, identifier) {
  const assignment = await Assignment.findOne({
    _id: identifier,
    ...publishedOrLegacy,
    ...notDeleted,
  });
  if (!assignment) throw new AssignmentError(404, 'Assignment not found.');
  await assertCanReadAssignment(user, assignment);
  return assignment;
}
