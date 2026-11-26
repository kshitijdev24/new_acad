import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import {
  AcademicSettings,
  Assignment,
  ComponentScore,
  Course,
  CourseEnrollment,
  CourseEvaluationScheme,
  CourseFaculty,
  CourseResult,
  GpaScenario,
  GradingScale,
  Semester,
  Student,
  Submission,
  User,
} from '../models.js';
import { assertStudentAccess } from '../services/performanceAuthorization.js';
import { getStudentForUser } from '../services/performanceService.js';
import {
  calculateCourseProgress,
  calculateGpa,
  calculatePrediction,
  generateGpaInsights,
  GpaError,
  requiredScoreForGrade,
  roundGpa,
  solveTargetGpa,
} from '../services/gpaService.js';
import { asyncHandler, featureErrorHandler, requireFeatureAuth, sendSuccess } from '../utils/http.js';
import {
  gpaEngineQuerySchema,
  gpaPredictSchema,
  gpaScenarioCreateSchema,
  gpaScenarioPatchSchema,
  gpaTargetSolverSchema,
  requiredScoreSchema,
} from '../validation/gpaSchemas.js';

const router = express.Router();
const requestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many GPA requests. Try again shortly.', data: null },
});
const simulationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many GPA simulations. Try again shortly.', data: null },
});
const disclaimer = 'This is a prediction only and is not an official academic result.';

const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'GPA Prediction API', version: '1.0.0' },
  paths: {
    '/gpa/engine': { get: { summary: 'Load the grading scale, current semester courses, and GPA' } },
    '/gpa/predict': { post: { summary: 'Predict semester GPA without changing academic records' } },
    '/gpa/target-solver': { post: { summary: 'Find achievable course-grade plans for a target GPA' } },
    '/gpa/course/{code}/required-score': { post: { summary: 'Calculate the remaining score required for a course grade' } },
    '/gpa/insights': { get: { summary: 'Load data-driven GPA insights and recommendations' } },
    '/gpa/scenarios': {
      get: { summary: 'List the signed-in user GPA scenarios' },
      post: { summary: 'Save a GPA scenario (maximum 20 per user)' },
    },
    '/gpa/scenarios/{id}': {
      patch: { summary: 'Rename or update a saved GPA scenario' },
      delete: { summary: 'Delete a saved GPA scenario' },
    },
  },
};

function requireMongo(_req, _res, next) {
  if (mongoose.connection.readyState !== 1) {
    next(new GpaError(503, 'GPA predictions require an active MongoDB connection.'));
    return;
  }
  next();
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

async function findStudent(identifier) {
  const student = mongoose.isValidObjectId(identifier)
    ? await Student.findOne({ $or: [{ _id: identifier }, { userId: String(identifier) }] })
    : await Student.findOne({ userId: String(identifier) });
  if (!student) throw new GpaError(404, 'Student profile not found.');
  return student;
}

async function assertFacultyStudentAccess(user, student) {
  if (user.role !== 'faculty') return;
  const semesters = await Semester.find({ studentId: student._id }).select('_id').lean();
  const courseIds = await CourseEnrollment.find({
    studentId: student._id,
    semesterId: { $in: semesters.map((semester) => semester._id) },
  }).distinct('courseId');
  const faculty = await User.findOne({ id: String(user.id || user._id) }).select('_id').lean();
  const [linkedCourses, legacyCourses] = await Promise.all([
    faculty
      ? CourseFaculty.find({ facultyId: faculty._id, courseId: { $in: courseIds }, active: true })
        .distinct('courseId')
      : [],
    Course.find({
      _id: { $in: courseIds },
      $or: [
        { facultyUserId: String(user.id || user._id) },
        { facultyName: new RegExp(`^${String(user.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    }).distinct('_id'),
  ]);
  if (![...linkedCourses, ...legacyCourses].length) {
    throw new GpaError(403, 'You do not teach courses for this student.');
  }
}

async function resolveStudent(user, requestedStudentId) {
  const student = requestedStudentId
    ? await findStudent(requestedStudentId)
    : await getStudentForUser(user);
  assertStudentAccess(user, student);
  await assertFacultyStudentAccess(user, student);
  return student;
}

async function resolveSemester(student, semesterId) {
  const semester = semesterId === 'current'
    ? await Semester.findOne({ studentId: student._id, status: 'current' }).sort({ semesterNumber: -1 })
    : await Semester.findOne({ _id: semesterId, studentId: student._id });
  if (!semester) throw new GpaError(404, 'No matching semester was found for this student.');
  return semester;
}

async function resolveScale(student) {
  const programId = student.programId || 'default';
  const scale = await GradingScale.findOne({
    effectiveFrom: { $lte: new Date() },
    $or: [
      { programId },
      { programId: 'default' },
      ...(student.institutionId ? [{ institutionId: student.institutionId }] : []),
    ],
  }).sort({ effectiveFrom: -1 }).lean();
  if (!scale) throw new GpaError(503, 'No grading scale is configured for this program.');
  return scale;
}

function componentScore(component, scoreByName, scoreByAssignment, assignmentById) {
  const nameKey = String(component.name || '').trim().toLowerCase();
  const assignmentId = component.assignmentId ? String(component.assignmentId) : null;
  const direct = (assignmentId && scoreByAssignment.get(assignmentId))
    || scoreByName.get(nameKey);
  if (direct?.status === 'graded') {
    return {
      weightPercent: component.weightPercent,
      obtainedMarks: direct.obtainedMarks,
      maxMarks: direct.maxMarks || component.maxMarks,
      status: 'graded',
    };
  }
  const assignment = assignmentId && assignmentById.get(assignmentId);
  const submission = assignment && scoreByAssignment.get(`assignment:${assignmentId}`);
  if (submission?.status === 'graded') {
    const maxMarks = Number(component.maxMarks || assignment.maxMarks || assignment.maxScore);
    const obtainedMarks = submission.obtainedMarks ?? submission.score
      ?? (submission.scorePercent == null ? null : Number(submission.scorePercent) * maxMarks / 100);
    return {
      weightPercent: component.weightPercent,
      obtainedMarks,
      maxMarks,
      status: obtainedMarks == null ? 'pending' : 'graded',
    };
  }
  return {
    weightPercent: component.weightPercent,
    obtainedMarks: null,
    maxMarks: component.maxMarks,
    status: 'pending',
  };
}

async function loadGpaContext(user, request) {
  const student = await resolveStudent(user, request.studentId);
  const semester = await resolveSemester(student, request.semesterId || 'current');
  const scale = await resolveScale(student);
  const enrollments = await CourseEnrollment.find({
    studentId: student._id,
    semesterId: semester._id,
  }).lean();
  const courseIds = enrollments.map((entry) => entry.courseId);
  const [courses, schemes, results, assignments, componentScores] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).lean(),
    CourseEvaluationScheme.find({
      courseId: { $in: courseIds },
      $or: [{ semesterId: semester._id }, { semesterId: null }],
    }).lean(),
    CourseResult.find({ studentId: student._id, semesterId: semester._id }).lean(),
    Assignment.find({ courseId: { $in: courseIds }, semesterId: semester._id }).lean(),
    ComponentScore.find({ studentId: student._id, semesterId: semester._id }).lean(),
  ]);
  const assignmentIds = assignments.map((assignment) => assignment._id);
  const submissions = await Submission.find({
    studentId: student._id,
    assignmentId: { $in: assignmentIds },
  }).lean();
  const courseById = new Map(courses.map((course) => [String(course._id), course]));
  const resultByCourse = new Map(results.map((result) => [String(result.courseId), result]));
  const assignmentById = new Map(assignments.map((assignment) => [String(assignment._id), assignment]));
  const assignmentScoreById = new Map(submissions.map((submission) => [
    `assignment:${String(submission.assignmentId)}`,
    submission,
  ]));
  const schemesByCourse = new Map();
  for (const scheme of schemes) {
    const key = String(scheme.courseId);
    const current = schemesByCourse.get(key);
    if (!current || sameId(scheme.semesterId, semester._id)) schemesByCourse.set(key, scheme);
  }

  const gpaCourses = [];
  for (const enrollment of enrollments) {
    const course = courseById.get(String(enrollment.courseId));
    if (!course) continue;
    const directScores = componentScores.filter((score) => sameId(score.courseId, course._id));
    const scoreByName = new Map(directScores.map((score) => [
      String(score.componentName).trim().toLowerCase(),
      score,
    ]));
    const scoreByAssignment = new Map();
    const scheme = schemesByCourse.get(String(course._id));
    const courseAssignments = assignments.filter((assignment) => sameId(assignment.courseId, course._id));
    const components = scheme
      ? scheme.components.map((component) => componentScore(
        component,
        scoreByName,
        assignmentScoreById,
        assignmentById
      ))
      : courseAssignments.map((assignment) => {
        const submission = assignmentScoreById.get(`assignment:${String(assignment._id)}`);
        const maxMarks = Number(assignment.maxMarks || assignment.maxScore || 100);
        const obtainedMarks = submission?.obtainedMarks ?? submission?.score
          ?? (submission?.scorePercent == null ? null : Number(submission.scorePercent) * maxMarks / 100);
        return {
          weightPercent: Number(assignment.weightPercent),
          obtainedMarks: submission?.status === 'graded' ? obtainedMarks : null,
          maxMarks,
          status: submission?.status === 'graded' && obtainedMarks != null ? 'graded' : 'pending',
        };
      });

    for (const score of directScores) {
      if (score.status !== 'graded') continue;
      const component = scheme?.components.find((item) =>
        String(item.name).trim().toLowerCase() === String(score.componentName).trim().toLowerCase()
      );
      if (!component) {
        components.push({
          weightPercent: Number(score.weightPercent || 0),
          obtainedMarks: score.obtainedMarks,
          maxMarks: score.maxMarks,
          status: 'graded',
        });
      }
    }

    const progress = calculateCourseProgress(components, scale);
    const result = resultByCourse.get(String(course._id));
    let currentGrade = result?.letterGrade || null;
    let isGradeFinal = Boolean(result?.isFinal);
    if (!currentGrade && enrollment.gradeStatus === 'graded' && enrollment.grade) {
      currentGrade = enrollment.grade;
      isGradeFinal = true;
    }
    if (!currentGrade) currentGrade = progress.currentGrade;
    if (currentGrade && !scale.grades.some((grade) => grade.letter === currentGrade)) {
      throw new GpaError(422, `${course.code} has an unrecognized stored grade "${currentGrade}".`);
    }
    const currentGradePoints = currentGrade
      ? scale.grades.find((grade) => grade.letter === currentGrade).points
      : null;
    const attendancePercent = course.attendancePercent == null
      ? null
      : Number(course.attendancePercent);
    gpaCourses.push({
      code: course.code,
      name: course.name,
      credits: Number(enrollment.credits ?? course.credits),
      facultyName: course.facultyName || '',
      currentGrade,
      currentGradePoints,
      currentPercent: progress.currentPercent,
      earnedWeightedPoints: progress.earnedWeightedPoints,
      evaluatedWeightPercent: progress.evaluatedWeightPercent,
      remainingWeightPercent: progress.remainingWeightPercent,
      attendancePercent,
      isGradeFinal,
      gradeStatus: enrollment.gradeStatus,
      gradingType: course.gradingType || 'letter',
      excludeFromGpa: course.gradingType === 'passFail' || course.gradingType === 'audit',
    });
  }

  const historical = await CourseEnrollment.find({
    studentId: student._id,
    gradeStatus: 'graded',
  }).populate('semesterId', 'semesterNumber status').lean();
  const completedAttempts = historical
    .filter((entry) => entry.semesterId
      && entry.semesterId.status === 'completed'
      && entry.semesterId.semesterNumber < semester.semesterNumber
      && Number(entry.credits) > 0
      && Number.isFinite(Number(entry.gradePoint)))
    .map((entry) => ({
      courseId: String(entry.courseId),
      semesterNumber: entry.semesterId.semesterNumber,
      attempt: entry.attempt || 1,
      credits: Number(entry.credits),
      gradePoint: Number(entry.gradePoint),
      updatedAt: entry.updatedAt,
    }));
  const settings = await AcademicSettings.findOne({ programId: student.programId || 'default' }).lean();
  const repeatPolicy = scale.repeatPolicy || settings?.repeatPolicy || 'latest';
  let cumulativeAttempts = completedAttempts;
  if (repeatPolicy === 'latest' || repeatPolicy === 'best') {
    const latestByCourse = new Map();
    for (const entry of completedAttempts) {
      const previous = latestByCourse.get(entry.courseId);
      if (!previous
        || (repeatPolicy === 'best' && entry.gradePoint > previous.gradePoint)
        || (repeatPolicy === 'latest'
          && (entry.semesterNumber > previous.semesterNumber
            || (entry.semesterNumber === previous.semesterNumber && entry.attempt > previous.attempt)))) {
        latestByCourse.set(entry.courseId, entry);
      }
    }
    cumulativeAttempts = [...latestByCourse.values()];
  }
  const completedCredits = cumulativeAttempts.reduce((sum, entry) => sum + entry.credits, 0);
  const completedPoints = cumulativeAttempts.reduce(
    (sum, entry) => sum + entry.credits * entry.gradePoint,
    0
  );
  const cumulativeGpa = completedCredits > 0
    ? roundGpa(completedPoints / completedCredits, scale.rounding?.sgpaDecimals ?? 2)
    : null;

  return {
    student,
    semester,
    scale,
    courses: gpaCourses,
    currentGpa: calculateGpa(gpaCourses, scale),
    cumulative: {
      cgpa: cumulativeGpa,
      currentCgpa: cumulativeGpa,
      completedCredits,
      completedPoints,
    },
    disclaimer,
  };
}

function assertCourseCodes(courses, gradeMap) {
  const knownCodes = new Set(courses.map((course) => course.code));
  const unknownCode = Object.keys(gradeMap).find((code) => !knownCodes.has(code));
  if (unknownCode) throw new GpaError(422, `Course "${unknownCode}" is not in this semester.`);
}

function scenarioJson(scenario) {
  return {
    id: String(scenario._id),
    name: scenario.name,
    semesterId: scenario.semesterId,
    predictedGrades: Object.fromEntries(scenario.predictedGrades || []),
    targetGpa: scenario.targetGpa,
    result: scenario.result,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  };
}

router.use(requestLimiter, requireFeatureAuth, requireMongo);
router.get('/gpa/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

router.get('/gpa/engine', asyncHandler(async (req, res) => {
  const query = gpaEngineQuerySchema.parse(req.query);
  const data = await loadGpaContext(req.user, query);
  return sendSuccess(res, 'GPA engine data loaded.', {
    scale: {
      name: data.scale.name,
      maxPoints: data.scale.maxPoints,
      grades: data.scale.grades,
      selectableGrades: data.scale.selectableGrades,
      minTarget: data.scale.minTarget,
      maxTarget: data.scale.maxTarget,
      step: data.scale.step,
    },
    semester: {
      id: String(data.semester._id),
      name: `Sem ${data.semester.semesterNumber}`,
      totalCredits: data.courses.reduce((sum, course) => sum + course.credits, 0),
    },
    courses: data.courses,
    currentGpa: data.currentGpa,
    cumulative: data.cumulative,
    disclaimer: data.disclaimer,
  });
}));

router.post('/gpa/predict', simulationLimiter, asyncHandler(async (req, res) => {
  const input = gpaPredictSchema.parse(req.body);
  const data = await loadGpaContext(req.user, input);
  assertCourseCodes(data.courses, input.predictedGrades);
  const result = calculatePrediction({
    courses: data.courses,
    scale: data.scale,
    predictedGrades: input.predictedGrades,
    cumulative: data.cumulative,
    includeCumulative: input.includeCumulative,
  });
  return sendSuccess(res, 'GPA prediction calculated.', result);
}));

router.post('/gpa/target-solver', simulationLimiter, asyncHandler(async (req, res) => {
  const input = gpaTargetSolverSchema.parse(req.body);
  const data = await loadGpaContext(req.user, input);
  assertCourseCodes(data.courses, input.lockedGrades);
  const result = solveTargetGpa({ ...input, courses: data.courses, scale: data.scale });
  return sendSuccess(res, 'Target GPA plans calculated.', result);
}));

router.post('/gpa/course/:code/required-score', asyncHandler(async (req, res) => {
  const input = requiredScoreSchema.parse({ ...req.body, semesterId: req.body?.semesterId || 'current' });
  const data = await loadGpaContext(req.user, input);
  const course = data.courses.find((entry) => entry.code === req.params.code);
  if (!course) throw new GpaError(404, 'Course is not enrolled in this semester.');
  const result = requiredScoreForGrade(course, input.desiredGrade, data.scale);
  return sendSuccess(res, 'Required remaining score calculated.', {
    ...result,
    disclaimer,
  });
}));

router.get('/gpa/insights', asyncHandler(async (req, res) => {
  const query = gpaEngineQuerySchema.parse(req.query);
  const data = await loadGpaContext(req.user, query);
  const latestScenario = await GpaScenario.findOne({
    userId: String(req.user.id || req.user._id),
    semesterId: String(data.semester._id),
    targetGpa: { $ne: null },
  }).sort({ updatedAt: -1 }).lean();
  const insights = generateGpaInsights({
    courses: data.courses,
    scale: data.scale,
    attendanceThreshold: data.scale.attendanceThresholdPercent,
    targetGpa: latestScenario?.targetGpa,
  });
  return sendSuccess(res, 'GPA insights loaded.', { items: insights, disclaimer });
}));

router.get('/gpa/scenarios', asyncHandler(async (req, res) => {
  const query = z.object({ semesterId: z.string().trim().min(1).max(100).optional() }).strict().parse(req.query);
  const filter = { userId: String(req.user.id || req.user._id) };
  if (query.semesterId) filter.semesterId = query.semesterId;
  const scenarios = await GpaScenario.find(filter).sort({ updatedAt: -1 }).lean();
  return sendSuccess(res, 'GPA scenarios loaded.', scenarios.map(scenarioJson));
}));

router.post('/gpa/scenarios', asyncHandler(async (req, res) => {
  const input = gpaScenarioCreateSchema.parse(req.body);
  const userId = String(req.user.id || req.user._id);
  const count = await GpaScenario.countDocuments({ userId });
  if (count >= 20) throw new GpaError(409, 'You can save up to 20 GPA scenarios.');
  const data = await loadGpaContext(req.user, input);
  assertCourseCodes(data.courses, input.predictedGrades);
  const prediction = calculatePrediction({
    courses: data.courses,
    scale: data.scale,
    predictedGrades: input.predictedGrades,
    cumulative: data.cumulative,
  });
  if (input.targetGpa != null
    && (input.targetGpa < data.scale.minTarget || input.targetGpa > data.scale.maxTarget)) {
    throw new GpaError(400, `Target GPA must be between ${data.scale.minTarget} and ${data.scale.maxTarget}.`);
  }
  const scenario = await GpaScenario.create({
    userId,
    semesterId: String(data.semester._id),
    name: input.name,
    predictedGrades: input.predictedGrades,
    targetGpa: input.targetGpa ?? null,
    result: prediction,
  });
  return sendSuccess(res, 'GPA scenario saved.', scenarioJson(scenario), 201);
}));

router.patch('/gpa/scenarios/:id', asyncHandler(async (req, res) => {
  const id = z.string().regex(/^[a-f\d]{24}$/i, 'A valid scenario ID is required.').parse(req.params.id);
  const input = gpaScenarioPatchSchema.parse(req.body);
  const userId = String(req.user.id || req.user._id);
  const scenario = await GpaScenario.findOne({ _id: id, userId });
  if (!scenario) throw new GpaError(404, 'GPA scenario not found.');
  const data = await loadGpaContext(req.user, { semesterId: scenario.semesterId });
  const predictedGrades = input.predictedGrades ?? Object.fromEntries(scenario.predictedGrades || []);
  assertCourseCodes(data.courses, predictedGrades);
  const targetGpa = input.targetGpa === undefined ? scenario.targetGpa : input.targetGpa;
  if (targetGpa != null && (targetGpa < data.scale.minTarget || targetGpa > data.scale.maxTarget)) {
    throw new GpaError(400, `Target GPA must be between ${data.scale.minTarget} and ${data.scale.maxTarget}.`);
  }
  const prediction = calculatePrediction({
    courses: data.courses,
    scale: data.scale,
    predictedGrades,
    cumulative: data.cumulative,
  });
  if (input.name !== undefined) scenario.name = input.name;
  scenario.predictedGrades = predictedGrades;
  scenario.targetGpa = targetGpa;
  scenario.result = prediction;
  await scenario.save();
  return sendSuccess(res, 'GPA scenario updated.', scenarioJson(scenario));
}));

router.delete('/gpa/scenarios/:id', asyncHandler(async (req, res) => {
  const id = z.string().regex(/^[a-f\d]{24}$/i, 'A valid scenario ID is required.').parse(req.params.id);
  const deleted = await GpaScenario.findOneAndDelete({
    _id: id,
    userId: String(req.user.id || req.user._id),
  });
  if (!deleted) throw new GpaError(404, 'GPA scenario not found.');
  return sendSuccess(res, 'GPA scenario deleted.', { id });
}));

router.use(featureErrorHandler);

export default router;
