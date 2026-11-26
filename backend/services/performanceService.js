import mongoose from 'mongoose';
import {
  AcademicSettings,
  Assignment,
  AssignmentStats,
  Course,
  CourseEnrollment,
  Semester,
  Student,
  Submission,
  User,
} from '../models.js';
import {
  calculateSemesterMetrics,
  cohortMeetsPrivacyThreshold,
  onTimePercentage,
  percentileForStudent,
  round,
  topPercentLabel,
  unweightedAverage,
  weightedAverage,
} from './performanceCalculations.js';

const cache = new Map();
const MAX_CACHE_ENTRIES = 500;

function cacheTtlMs() {
  return Math.max(1000, Number(process.env.PERFORMANCE_CACHE_TTL_MS) || 5 * 60 * 1000);
}

export class PerformanceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function invalidatePerformanceCache(studentId) {
  if (studentId == null) {
    cache.clear();
    return;
  }
  const prefix = `${String(studentId)}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function cacheSet(key, value) {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs() });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

function trendCacheKey(studentId, options = {}) {
  return `${String(studentId)}:${JSON.stringify({
    fromSemester: options.fromSemester || '',
    toSemester: options.toSemester || '',
    courseId: options.courseId || '',
    includeCohort: options.includeCohort !== false,
    allowedCourseIds: options.allowedCourseIds
      ? options.allowedCourseIds.map(String).sort()
      : [],
  })}`;
}

export function getCachedPerformanceTrend(studentId, options = {}) {
  return cacheGet(trendCacheKey(studentId, options));
}

export function cachePerformanceTrend(studentId, options, value) {
  cacheSet(trendCacheKey(studentId, options), value);
}

export async function getStudentForUser(user) {
  let student = await Student.findOne({ userId: String(user.id || user._id) });
  if (student) return student;

  const storedUser = await User.findOne({ id: String(user.id || user._id) }).select('department');
  if (!storedUser) throw new PerformanceError(404, 'Student profile not found.');
  student = await Student.findOneAndUpdate(
    { userId: storedUser.id },
    {
      $setOnInsert: {
        programId: storedUser.department || '',
        enrollmentYear: new Date().getFullYear(),
        cohortId: `${storedUser.department || 'program'}-${new Date().getFullYear()}`,
      },
    },
    { new: true, upsert: true }
  );
  return student;
}

export async function getAcademicSettings(programId = 'default') {
  const requestedProgram = programId || 'default';
  const existing = await AcademicSettings.findOne({ programId: requestedProgram });
  if (existing) return existing;
  if (requestedProgram !== 'default') {
    const defaults = await AcademicSettings.findOne({ programId: 'default' });
    if (defaults) return defaults;
  }
  return AcademicSettings.findOneAndUpdate(
    { programId: requestedProgram },
    { $setOnInsert: { programId: requestedProgram } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function recomputeStudentSemesters(studentId) {
  const enrollments = await CourseEnrollment.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(String(studentId)) } },
    {
      $lookup: {
        from: Semester.collection.name,
        localField: 'semesterId',
        foreignField: '_id',
        as: 'semester',
      },
    },
    { $unwind: '$semester' },
    { $sort: { 'semester.semesterNumber': 1, courseId: 1, attempt: 1, updatedAt: 1 } },
    {
      $group: {
        _id: {
          semesterNumber: '$semester.semesterNumber',
          courseId: '$courseId',
          attempt: '$attempt',
        },
        gradePoint: { $last: '$gradePoint' },
        credits: { $last: '$credits' },
        gradeStatus: { $last: '$gradeStatus' },
        updatedAt: { $last: '$updatedAt' },
      },
    },
    {
      $project: {
        _id: 0,
        courseId: '$_id.courseId',
        semesterNumber: '$_id.semesterNumber',
        gradePoint: 1,
        credits: 1,
        gradeStatus: 1,
        attempt: '$_id.attempt',
        updatedAt: 1,
      },
    },
  ]);
  const settings = await getAcademicSettings(
    (await Student.findById(studentId).select('programId').lean())?.programId
  );
  const metrics = calculateSemesterMetrics(enrollments, settings.repeatPolicy, settings);
  const metricBySemester = new Map(metrics.map((metric) => [metric.semesterNumber, metric]));
  const semesters = await Semester.find({ studentId }).sort({ semesterNumber: 1 }).lean();
  let cumulativeCgpa = null;
  for (const semester of semesters) {
    const metric = metricBySemester.get(semester.semesterNumber);
    if (metric?.cgpa != null) cumulativeCgpa = metric.cgpa;
    await Semester.updateOne(
      { _id: semester._id },
      {
        $set: {
          sgpa: metric?.sgpa ?? null,
          cgpa: metric?.cgpa ?? cumulativeCgpa,
          credits: metric?.credits ?? 0,
        },
      }
    );
  }
  invalidatePerformanceCache(studentId);
  return metrics;
}

export async function recomputeAssignmentStats(assignmentId) {
  const [aggregate] = await Submission.aggregate([
    {
      $match: {
        assignmentId: new mongoose.Types.ObjectId(String(assignmentId)),
        status: 'graded',
        scorePercent: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$assignmentId',
        classAveragePercent: { $avg: '$scorePercent' },
        scores: { $push: '$scorePercent' },
        submissionCount: { $sum: 1 },
      },
    },
  ]);
  if (!aggregate) {
    return AssignmentStats.findOneAndUpdate(
      { assignmentId },
      { $set: { classAveragePercent: null, medianPercent: null, stdDev: null, submissionCount: 0, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
  }
  const scores = aggregate.scores.map(Number).sort((a, b) => a - b);
  const middle = Math.floor(scores.length / 2);
  const medianPercent = scores.length % 2
    ? scores[middle]
    : (scores[middle - 1] + scores[middle]) / 2;
  const mean = aggregate.classAveragePercent;
  const stdDev = Math.sqrt(scores.reduce((sum, score) => sum + ((score - mean) ** 2), 0) / scores.length);
  return AssignmentStats.findOneAndUpdate(
    { assignmentId },
    {
      $set: {
        classAveragePercent: round(mean, 2),
        medianPercent: round(medianPercent, 2),
        stdDev: round(stdDev, 2),
        submissionCount: aggregate.submissionCount,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
}

export async function handleSubmissionChange(submission) {
  try {
    await recomputeAssignmentStats(submission.assignmentId);
  } finally {
    invalidatePerformanceCache();
  }
}

function dateLabel(date) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(parsed).replace(/(\w{3}) 0(\d)/, '$1 $2');
}

function publicStatus(status) {
  if (status === 'graded') return 'Graded';
  if (status === 'submitted' || status === 'late') return 'Submitted';
  return 'Pending';
}

export async function getPerformanceTrend(student, options = {}) {
  const studentId = student._id || student.id;
  const cached = getCachedPerformanceTrend(studentId, options);
  if (cached) return cached;

  const settings = await getAcademicSettings(student.programId);
  let course = null;
  if (options.courseId) {
    course = mongoose.isValidObjectId(options.courseId)
      ? await Course.findById(options.courseId).select('_id code name')
      : await Course.findOne({ code: options.courseId }).select('_id code name');
    if (!course) throw new PerformanceError(404, 'Course not found.');
  }

  const semesterFilter = { studentId };
  if (options.fromSemester != null || options.toSemester != null) {
    semesterFilter.semesterNumber = {};
    if (options.fromSemester != null) semesterFilter.semesterNumber.$gte = options.fromSemester;
    if (options.toSemester != null) semesterFilter.semesterNumber.$lte = options.toSemester;
  }
  const semesters = await Semester.find(semesterFilter).sort({ semesterNumber: 1 }).lean();
  let trendSemesters = semesters;
  if (options.allowedCourseIds) {
    const courseEnrollments = semesters.length
      ? await CourseEnrollment.aggregate([
        {
          $match: {
            studentId: new mongoose.Types.ObjectId(String(studentId)),
            semesterId: { $in: semesters.map((semester) => semester._id) },
            courseId: { $in: options.allowedCourseIds },
          },
        },
        {
          $lookup: {
            from: Semester.collection.name,
            localField: 'semesterId',
            foreignField: '_id',
            as: 'semester',
          },
        },
        { $unwind: '$semester' },
        { $sort: { 'semester.semesterNumber': 1, courseId: 1, attempt: 1, updatedAt: 1 } },
        {
          $group: {
            _id: {
              semesterNumber: '$semester.semesterNumber',
              courseId: '$courseId',
              attempt: '$attempt',
            },
            gradePoint: { $last: '$gradePoint' },
            credits: { $last: '$credits' },
            gradeStatus: { $last: '$gradeStatus' },
            updatedAt: { $last: '$updatedAt' },
          },
        },
        {
          $project: {
            _id: 0,
            courseId: '$_id.courseId',
            semesterNumber: '$_id.semesterNumber',
            gradePoint: 1,
            credits: 1,
            gradeStatus: 1,
            attempt: '$_id.attempt',
            updatedAt: 1,
          },
        },
      ])
      : [];
    const metrics = calculateSemesterMetrics(courseEnrollments, settings.repeatPolicy, settings);
    const metricByNumber = new Map(metrics.map((metric) => [metric.semesterNumber, metric]));
    trendSemesters = semesters.filter((semester) => metricByNumber.has(semester.semesterNumber))
      .map((semester) => ({ ...semester, ...metricByNumber.get(semester.semesterNumber) }));
  }
  const semesterIds = trendSemesters.map((semester) => semester._id);
  const assignmentFilter = { semesterId: { $in: semesterIds } };
  if (course) assignmentFilter.courseId = course._id;
  if (options.allowedCourseIds) {
    assignmentFilter.courseId = { $in: options.allowedCourseIds };
  }
  const assignments = semesterIds.length
    ? await Assignment.find(assignmentFilter).sort({ dueDate: 1, createdAt: 1 }).lean()
    : [];
  const assignmentIds = assignments.map((assignment) => assignment._id);
  const ownerSubmissions = assignmentIds.length
    ? await Submission.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(String(studentId)), assignmentId: { $in: assignmentIds } } },
      { $project: { assignmentId: 1, score: 1, scorePercent: 1, status: 1, submittedAt: 1, submittedOnTime: 1, updatedAt: 1 } },
    ])
    : [];
  const cohortMatch = {
    assignmentId: { $in: assignmentIds },
    status: 'graded',
    scorePercent: { $ne: null },
  };
  if (settings.excludeOwnScore) {
    cohortMatch.studentId = { $ne: new mongoose.Types.ObjectId(String(studentId)) };
  }
  const [gradedGroups, assignmentStats] = assignmentIds.length
    ? await Promise.all([
      Submission.aggregate([
        { $match: cohortMatch },
        {
          $group: {
            _id: '$assignmentId',
            classAveragePercent: { $avg: '$scorePercent' },
            submissionCount: { $sum: 1 },
          },
        },
      ]),
      AssignmentStats.find({ assignmentId: { $in: assignmentIds } })
        .select('classAveragePercent updatedAt')
        .lean(),
    ])
    : [[], []];
  const groupedByAssignment = new Map(gradedGroups.map((group) => [String(group._id), group]));
  const statsByAssignment = new Map(assignmentStats.map((stats) => [String(stats.assignmentId), stats]));
  const ownerByAssignment = new Map(ownerSubmissions.map((submission) => [String(submission.assignmentId), submission]));
  const courseIds = [...new Set(assignments.map((assignment) => String(assignment.courseId || '')).filter(Boolean))];
  const courses = courseIds.length
    ? await Course.find({ _id: { $in: courseIds } }).select('code name').lean()
    : [];
  const courseById = new Map(courses.map((item) => [String(item._id), item]));

  const assignmentRows = assignments.map((assignment) => {
    const submission = ownerByAssignment.get(String(assignment._id));
    const cohort = groupedByAssignment.get(String(assignment._id));
    const stats = statsByAssignment.get(String(assignment._id));
    const ownScore = submission?.status === 'graded' ? Number(submission.scorePercent) : null;
    const visibleCohort = options.includeCohort !== false
      && cohortMeetsPrivacyThreshold(cohort?.submissionCount || 0, settings.privacyThreshold);
    const classAveragePercent = visibleCohort
      ? round(
        !settings.excludeOwnScore && stats?.classAveragePercent != null
          ? stats.classAveragePercent
          : cohort.classAveragePercent,
        1
      )
      : null;
    const maxScore = Number(assignment.maxScore ?? assignment.maxMarks ?? 0);
    const scorePercent = ownScore != null
      ? round(ownScore, 1)
      : submission?.score != null && maxScore > 0
        ? round((Number(submission.score) / maxScore) * 100, 1)
        : null;
    const dueDate = assignment.dueDate;
    const submittedOnTime = submission?.submittedOnTime
      ?? (submission?.submittedAt && dueDate
        ? new Date(submission.submittedAt).getTime() <= new Date(dueDate).getTime()
        : null);
    return {
      id: String(assignment._id),
      title: assignment.title,
      courseId: String(assignment.courseId || ''),
      courseCode: courseById.get(String(assignment.courseId))?.code || assignment.courseCode || '',
      date: dateLabel(dueDate),
      isoDate: dueDate && !Number.isNaN(new Date(dueDate).getTime())
        ? new Date(dueDate).toISOString()
        : null,
      scorePercent,
      classAveragePercent,
      weight: Number(assignment.weightPercent ?? 0),
      status: publicStatus(submission?.status),
      submittedOnTime: submittedOnTime == null ? null : Boolean(submittedOnTime),
      type: assignment.type || 'assignment',
      updatedAt: submission?.updatedAt || assignment.updatedAt,
    };
  });

  const gradedAssignments = assignmentRows.filter((item) => item.status === 'Graded' && item.scorePercent != null);
  const hasCompleteCohort = gradedAssignments.length > 0
    && gradedAssignments.every((item) => item.classAveragePercent != null);
  const avgAssignmentScore = weightedAverage(gradedAssignments, 'scorePercent', 'weight');
  const avgCohortScore = hasCompleteCohort
    ? weightedAverage(gradedAssignments, 'classAveragePercent', 'weight')
    : null;
  const avgAssignmentUnweighted = unweightedAverage(gradedAssignments.map((item) => item.scorePercent));
  const avgCohortUnweighted = hasCompleteCohort
    ? unweightedAverage(gradedAssignments.map((item) => item.classAveragePercent))
    : null;
  let cohortAverages = [];
  const cohortId = assignments.find((assignment) => assignment.cohortId)?.cohortId || student.cohortId;
  const percentileAssignmentIds = gradedAssignments.map((item) => new mongoose.Types.ObjectId(item.id));
  if (options.includeCohort !== false && cohortId && percentileAssignmentIds.length) {
    cohortAverages = await Submission.aggregate([
      {
        $match: {
          assignmentId: { $in: percentileAssignmentIds },
          status: 'graded',
          scorePercent: { $ne: null },
        },
      },
      {
        $lookup: {
          from: Assignment.collection.name,
          localField: 'assignmentId',
          foreignField: '_id',
          as: 'assignment',
        },
      },
      { $unwind: '$assignment' },
      { $match: { 'assignment.cohortId': cohortId } },
      {
        $group: {
          _id: { studentId: '$studentId', assignmentId: '$assignmentId' },
          weightedScore: {
            $sum: {
              $multiply: ['$scorePercent', { $ifNull: ['$assignment.weightPercent', 0] }],
            },
          },
          weight: { $max: { $ifNull: ['$assignment.weightPercent', 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.studentId',
          weightedScore: { $sum: '$weightedScore' },
          weight: { $sum: '$weight' },
        },
      },
      { $match: { weight: { $gt: 0 } } },
      { $project: { _id: 0, studentId: '$_id', average: { $divide: ['$weightedScore', '$weight'] } } },
    ]);
  }
  const percentile = options.includeCohort !== false && hasCompleteCohort && percentileAssignmentIds.length
    ? percentileForStudent(cohortAverages, studentId, avgAssignmentScore, settings.privacyThreshold)
    : null;
  const firstSemester = trendSemesters.find((semester) => semester.sgpa != null);
  const currentSemester = [...trendSemesters].reverse().find((semester) => semester.cgpa != null);
  const firstSgpa = firstSemester?.sgpa ?? null;
  const currentCgpa = currentSemester?.cgpa ?? null;
  const latestUpdatedAt = [
    ...trendSemesters.map((semester) => semester.updatedAt),
    ...assignmentRows.map((assignment) => assignment.updatedAt),
    ...assignmentStats.map((stats) => stats.updatedAt),
  ].filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
  const semesterRangeLabel = trendSemesters.length
    ? `${trendSemesters[0].semesterNumber === trendSemesters[trendSemesters.length - 1].semesterNumber
      ? `Sem ${trendSemesters[0].semesterNumber}`
      : `Sem ${trendSemesters[0].semesterNumber} to Sem ${trendSemesters[trendSemesters.length - 1].semesterNumber}`}`
    : '';
  const data = {
    semesters: trendSemesters.map((semester) => ({
      name: `Sem ${semester.semesterNumber}`,
      semesterNumber: semester.semesterNumber,
      year: semester.academicYear,
      sgpa: semester.sgpa,
      cgpa: semester.cgpa,
      credits: semester.credits,
      isCurrent: semester.status === 'current',
    })),
    assignments: assignmentRows.map(({ updatedAt, ...assignment }) => assignment),
    kpis: {
      currentCgpa,
      firstSgpa,
      cgpaGrowth: currentCgpa == null || firstSgpa == null ? null : round(currentCgpa - firstSgpa),
      avgAssignmentScore,
      unweightedAvgAssignmentScore: avgAssignmentUnweighted,
      avgCohortScore,
      unweightedAvgCohortScore: avgCohortUnweighted,
      outperformanceDelta: avgAssignmentScore == null || avgCohortScore == null
        ? null
        : round(avgAssignmentScore - avgCohortScore, 1),
      assignmentPercentile: percentile,
      topPercentLabel: topPercentLabel(percentile),
      distinction: {
        threshold: settings.distinctionThreshold,
        label: settings.distinctionLabel,
        achieved: currentCgpa != null && currentCgpa >= settings.distinctionThreshold,
      },
      gradedCount: gradedAssignments.length,
      totalAssignments: assignments.length,
      onTimePercent: onTimePercentage(assignmentRows),
      benchmarkPercent: settings.benchmarkPercent,
      gpaScale: settings.gpaScale,
    },
    meta: {
      semesterRangeLabel,
      lastUpdated: latestUpdatedAt.length ? new Date(Math.max(...latestUpdatedAt)).toISOString() : null,
    },
  };
  cachePerformanceTrend(studentId, options, data);
  return data;
}

export async function listStudentSemesters(studentId, { page = 1, limit = 20 } = {}) {
  const [semesters, total] = await Promise.all([
    Semester.find({ studentId }).sort({ semesterNumber: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Semester.countDocuments({ studentId }),
  ]);
  return { items: semesters, page, limit, total };
}

export async function listStudentAssignments(studentId, { semesterId, status, page = 1, limit = 20 } = {}) {
  const semesterQuery = { studentId };
  if (semesterId) semesterQuery._id = semesterId;
  const semesters = await Semester.find(semesterQuery).select('_id').lean();
  const assignmentQuery = { semesterId: { $in: semesters.map((semester) => semester._id) } };
  if (status) {
    assignmentQuery._id = {
      $in: await Submission.find({ studentId, status }).distinct('assignmentId'),
    };
  }
  const [items, total] = await Promise.all([
    Assignment.find(assignmentQuery).sort({ dueDate: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Assignment.countDocuments(assignmentQuery),
  ]);
  const submissions = await Submission.find({
    studentId,
    assignmentId: { $in: items.map((item) => item._id) },
  }).lean();
  const byAssignment = new Map(submissions.map((submission) => [String(submission.assignmentId), submission]));
  const filteredItems = items.map((assignment) => ({
    ...assignment,
    submission: byAssignment.get(String(assignment._id)) || null,
  }));
  return { items: filteredItems, page, limit, total };
}

export async function saveSemesterWithEnrollments(studentId, input, existing = null) {
  const student = await Student.findById(studentId).select('programId').lean();
  if (!student) throw new PerformanceError(404, 'Student not found.');
  const settings = await getAcademicSettings(student.programId);
  if (input.enrollments?.length) {
    if (input.enrollments.some((enrollment) => enrollment.gradePoint > settings.gpaScale)) {
      throw new PerformanceError(400, 'A grade point cannot exceed the configured GPA scale.');
    }
    const courseIds = [...new Set(input.enrollments.map((enrollment) => String(enrollment.courseId)))];
    const courseCount = await Course.countDocuments({ _id: { $in: courseIds } });
    if (courseCount !== courseIds.length) {
      throw new PerformanceError(400, 'One or more enrolled courses do not exist.');
    }
  }
  const semester = existing || new Semester({ studentId });
  Object.assign(semester, {
    semesterNumber: input.semesterNumber ?? semester.semesterNumber,
    academicYear: input.academicYear ?? semester.academicYear,
    status: input.status ?? semester.status,
  });
  if (input.enrollments) {
    semester.gradePoints = input.enrollments.map((enrollment) => ({
      courseId: enrollment.courseId,
      credits: enrollment.credits,
      gradePoint: enrollment.gradePoint,
      gradeStatus: enrollment.gradeStatus,
      attempt: enrollment.attempt,
    }));
  }
  await semester.save();
  if (input.enrollments) {
    for (const enrollment of input.enrollments) {
      await CourseEnrollment.findOneAndUpdate(
        {
          studentId,
          semesterId: semester._id,
          courseId: enrollment.courseId,
          attempt: enrollment.attempt || 1,
        },
        { $set: { ...enrollment, studentId, semesterId: semester._id } },
        { upsert: true, new: true, runValidators: true }
      );
    }
  }
  await recomputeStudentSemesters(studentId);
  return Semester.findById(semester._id).lean();
}

export function currentCacheTtlMs() {
  return cacheTtlMs();
}
