import {
  calculateGpa,
  calculatePrediction,
  calculateCourseProgress,
  generateGpaInsights,
  requiredScoreForGrade,
  solveTargetGpa,
} from '../services/gpaService.js';

const scale4 = {
  name: '4.0 Scale',
  maxPoints: 4,
  minTarget: 2,
  maxTarget: 4,
  step: 0.05,
  rounding: { sgpaDecimals: 2, mode: 'half-up' },
  selectableGrades: ['A', 'A-', 'B+', 'B', 'C', 'F'],
  grades: [
    { letter: 'A', points: 4, minPercent: 90 },
    { letter: 'A-', points: 3.7, minPercent: 85 },
    { letter: 'B+', points: 3.3, minPercent: 80 },
    { letter: 'B', points: 3, minPercent: 70 },
    { letter: 'C', points: 2, minPercent: 60 },
    { letter: 'F', points: 0, minPercent: 0 },
  ],
};

const scale10 = {
  ...scale4,
  name: '10.0 Scale',
  maxPoints: 10,
  minTarget: 4,
  maxTarget: 10,
  step: 0.1,
  grades: [
    { letter: 'O', points: 10, minPercent: 90 },
    { letter: 'A+', points: 9, minPercent: 80 },
    { letter: 'B', points: 8, minPercent: 70 },
    { letter: 'F', points: 0, minPercent: 0 },
  ],
  selectableGrades: ['O', 'A+', 'B', 'F'],
};

describe('GPA calculations', () => {
  test('calculates credit-weighted GPA on 4-point and 10-point scales', () => {
    expect(calculateGpa([
      { code: 'A', credits: 3, currentGrade: 'A' },
      { code: 'B', credits: 1, currentGrade: 'B+' },
    ], scale4)).toBe(3.83);
    expect(calculateGpa([
      { code: 'A', credits: 3, currentGrade: 'O' },
      { code: 'B', credits: 1, currentGrade: 'A+' },
    ], scale10)).toBe(9.75);
  });

  test('rounds half-up without floating-point drift and excludes non-credit courses', () => {
    const roundingScale = {
      ...scale4,
      grades: [
        { letter: 'A', points: 3.7, minPercent: 90 },
        { letter: 'B', points: 3.69, minPercent: 80 },
      ],
    };
    expect(calculateGpa([
      { code: 'A', credits: 1, currentGrade: 'A' },
      { code: 'B', credits: 1, currentGrade: 'B' },
    ], roundingScale)).toBe(3.7);
    expect(calculateGpa([
      { code: 'A', credits: 1, currentGrade: 'A-' },
      { code: 'B', credits: 1, currentGrade: 'B+' },
    ], scale4)).toBe(3.5);
    expect(calculateGpa([
      { code: 'A', credits: 1, currentGrade: 'A' },
      { code: 'P', credits: 3, currentGrade: 'A', gradingType: 'passFail' },
      { code: 'W', credits: 3, currentGrade: 'B', gradeStatus: 'withdrawn' },
    ], scale4)).toBe(4);
    expect(calculateGpa([{ credits: 0, currentGrade: 'A' }], scale4)).toBeNull();
  });

  test('rejects unknown grades instead of substituting points', () => {
    expect(() => calculateGpa([
      { code: 'A', credits: 3, currentGrade: 'UNKNOWN' },
    ], scale4)).toThrow(expect.objectContaining({ status: 422 }));
  });

  test('calculates weighted marks normalized by evaluated weight', () => {
    expect(calculateCourseProgress([
      { weightPercent: 60, obtainedMarks: 80, maxMarks: 100, status: 'graded' },
      { weightPercent: 40, obtainedMarks: null, maxMarks: 100, status: 'pending' },
    ])).toMatchObject({
      currentPercent: 80,
      earnedWeightedPoints: 48,
      evaluatedWeightPercent: 60,
      remainingWeightPercent: 40,
    });
  });

  test('computes required score and marks impossible remaining-work requirements', () => {
    const course = {
      code: 'A',
      earnedWeightedPoints: 48,
      remainingWeightPercent: 40,
      currentGrade: 'B',
    };
    expect(requiredScoreForGrade(course, 'A', scale4)).toMatchObject({
      requiredOnRemaining: 105,
      feasible: false,
    });
    expect(requiredScoreForGrade({
      ...course,
      earnedWeightedPoints: 54,
      remainingWeightPercent: 40,
    }, 'A', scale4)).toMatchObject({
      requiredOnRemaining: 90,
      feasible: true,
    });
  });
});

describe('GPA target solver and insights', () => {
  const courses = [
    {
      code: 'A',
      credits: 4,
      currentGrade: 'B',
      currentGradePoints: 3,
      currentPercent: 75,
      earnedWeightedPoints: 45,
      evaluatedWeightPercent: 60,
      remainingWeightPercent: 40,
      isGradeFinal: false,
    },
    {
      code: 'B',
      credits: 3,
      currentGrade: 'B+',
      currentGradePoints: 3.3,
      currentPercent: 82,
      earnedWeightedPoints: 49.2,
      evaluatedWeightPercent: 60,
      remainingWeightPercent: 40,
      isGradeFinal: false,
    },
  ];

  test('returns a concrete plan that reaches the target and respects locked grades', () => {
    const result = solveTargetGpa({
      courses,
      scale: scale4,
      targetGpa: 3.5,
      lockedGrades: { B: 'B+' },
    });
    expect(result.isFeasible).toBe(true);
    expect(result.suggestedPlans.length).toBeGreaterThan(0);
    expect(result.suggestedPlans[0].resultingGpa).toBeGreaterThanOrEqual(3.5);
    expect(result.suggestedPlans[0].changes.every((change) => change.code !== 'B')).toBe(true);
  });

  test('reports the maximum achievable GPA when a target is infeasible', () => {
    const result = solveTargetGpa({
      courses,
      scale: scale4,
      targetGpa: 4,
      lockedGrades: { A: 'B', B: 'B+' },
    });
    expect(result.isFeasible).toBe(false);
    expect(result.achievableMax).toBeLessThan(4);
    expect(result.suggestedPlans[0].resultingGpa).toBe(result.achievableMax);
  });

  test('blocks changes to finalized courses and produces data-driven risk insights', () => {
    expect(() => calculatePrediction({
      courses: [{ ...courses[0], isGradeFinal: true }],
      scale: scale4,
      predictedGrades: { A: 'A' },
    })).toThrow(expect.objectContaining({ status: 422 }));

    const insights = generateGpaInsights({
      courses: [{ ...courses[0], currentPercent: 71, attendancePercent: 70 }],
      scale: scale4,
      attendanceThreshold: 75,
    });
    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'risk', courseCodes: ['A'] }),
    ]));
  });
});
