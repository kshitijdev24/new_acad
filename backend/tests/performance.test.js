import { jest } from '@jest/globals';
import {
  calculateSemesterMetrics,
  cohortMeetsPrivacyThreshold,
  gpaForEnrollments,
  onTimePercentage,
  percentileForStudent,
  topPercentLabel,
  weightedAverage,
} from '../services/performanceCalculations.js';
import { assertStudentAccess } from '../services/performanceAuthorization.js';
import {
  cachePerformanceTrend,
  getCachedPerformanceTrend,
  handleSubmissionChange,
  invalidatePerformanceCache,
} from '../services/performanceService.js';
import { AssignmentStats, Submission } from '../models.js';
import '../routes/performanceRoutes.js';

describe('academic performance calculations', () => {
  test('calculates SGPA and cumulative GPA using the latest graded repeat', () => {
    const records = calculateSemesterMetrics([
      { semesterNumber: 1, courseId: 'course-a', credits: 3, gradePoint: 3, gradeStatus: 'graded', attempt: 1 },
      { semesterNumber: 1, courseId: 'course-b', credits: 1, gradePoint: 4, gradeStatus: 'graded', attempt: 1 },
      { semesterNumber: 2, courseId: 'course-a', credits: 3, gradePoint: 4, gradeStatus: 'graded', attempt: 2 },
      { semesterNumber: 2, courseId: 'course-c', credits: 0, gradePoint: 2, gradeStatus: 'graded', attempt: 1 },
    ]);

    expect(records).toEqual([
      { semesterNumber: 1, sgpa: 3.25, credits: 4, cgpa: 3.25 },
      { semesterNumber: 2, sgpa: 4, credits: 3, cgpa: 4 },
    ]);
  });

  test('excludes incomplete, withdrawn, and zero-credit courses without dividing by zero', () => {
    expect(gpaForEnrollments([
      { courseId: 'a', credits: 3, gradePoint: 4, gradeStatus: 'incomplete' },
      { courseId: 'b', credits: 3, gradePoint: 3, gradeStatus: 'withdrawn' },
      { courseId: 'c', credits: 0, gradePoint: 4, gradeStatus: 'graded' },
    ])).toEqual({ gpa: null, credits: 0 });
  });

  test('applies configured policies for incomplete repeat attempts', () => {
    const attempts = [
      { semesterNumber: 1, courseId: 'course-a', credits: 3, gradePoint: 3, gradeStatus: 'graded', attempt: 1 },
      { semesterNumber: 2, courseId: 'course-a', credits: 3, gradePoint: 2, gradeStatus: 'incomplete', attempt: 2 },
    ];
    expect(calculateSemesterMetrics(attempts)[1].cgpa).toBe(3);
    expect(calculateSemesterMetrics(attempts, 'latest', { incompletePolicy: 'include' })[1].cgpa).toBe(2);
  });

  test('calculates weighted assignment averages from weights', () => {
    expect(weightedAverage([
      { score: 90, weight: 10 },
      { score: 70, weight: 30 },
      { score: null, weight: 50 },
    ], 'score', 'weight')).toBe(75);
  });

  test('calculates percentile below the student, preserves ties, and enforces cohort privacy', () => {
    const cohort = [
      { studentId: 'a', average: 80 },
      { studentId: 'b', average: 80 },
      { studentId: 'c', average: 70 },
      { studentId: 'd', average: 90 },
      { studentId: 'e', average: 60 },
    ];
    expect(percentileForStudent(cohort, 'a', 80, 5)).toBe(50);
    expect(percentileForStudent(cohort.slice(0, 4), 'a', 80, 5)).toBeNull();
    expect(topPercentLabel(92)).toBe('Top 10%');
    expect(cohortMeetsPrivacyThreshold(5, 5)).toBe(true);
    expect(cohortMeetsPrivacyThreshold(4, 5)).toBe(false);
  });

  test('calculates on-time percentage for submitted and graded work only', () => {
    expect(onTimePercentage([
      { status: 'submitted', submittedOnTime: true },
      { status: 'Graded', submittedOnTime: true },
      { status: 'late', submittedOnTime: false },
      { status: 'pending', submittedOnTime: null },
    ])).toBe(66.7);
    expect(onTimePercentage([{ status: 'pending' }])).toBeNull();
  });
});

describe('performance access and cache invalidation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    invalidatePerformanceCache();
  });

  test('a student cannot access another student profile', () => {
    expect(() => assertStudentAccess(
      { id: 'student-a', role: 'student' },
      { userId: 'student-b' }
    )).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => assertStudentAccess(
      { id: 'student-a', role: 'student' },
      { userId: 'student-a' }
    )).not.toThrow();
  });

  test('a saved grade invalidates cached trend data', async () => {
    cachePerformanceTrend('student-a', {}, { kpis: { avgAssignmentScore: 80 } });
    expect(getCachedPerformanceTrend('student-a', {})).not.toBeNull();
    jest.spyOn(Submission, 'aggregate').mockResolvedValue([]);
    jest.spyOn(AssignmentStats, 'findOneAndUpdate').mockResolvedValue({});

    await handleSubmissionChange({ assignmentId: '0123456789abcdef01234567', studentId: 'student-a' });

    expect(getCachedPerformanceTrend('student-a', {})).toBeNull();
  });
});
