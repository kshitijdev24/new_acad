export class GpaError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isFiniteNumber = (value) => Number.isFinite(Number(value));
const hasGpaCredits = (course, scale) => (
  !course.excludeFromGpa
  && !(course.gradingType === 'passFail' && scale.excludePassFail !== false)
  && !(course.gradingType === 'audit' && scale.excludeAudit !== false)
  && !(course.gradeStatus === 'withdrawn' && scale.excludeWithdrawn !== false)
);

export function roundGpa(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.floor((value + Number.EPSILON) * factor + 0.5) / factor;
}

function gradeByLetter(scale, letter) {
  const grade = scale.grades.find((entry) => entry.letter === letter);
  if (!grade) {
    throw new GpaError(422, `Grade "${letter}" is not present in the grading scale.`);
  }
  return grade;
}

function gradeForPercent(scale, percent) {
  return [...scale.grades]
    .sort((left, right) => right.minPercent - left.minPercent)
    .find((grade) => percent >= grade.minPercent) || null;
}

export function calculateCourseProgress(components = [], scale) {
  const evaluated = components.filter((component) => (
    String(component.status || '').toLowerCase() === 'graded'
    && isFiniteNumber(component.obtainedMarks)
    && isFiniteNumber(component.maxMarks)
    && Number(component.maxMarks) > 0
    && isFiniteNumber(component.weightPercent)
    && Number(component.weightPercent) > 0
  ));
  const evaluatedWeightPercent = evaluated.reduce(
    (sum, component) => sum + Number(component.weightPercent),
    0
  );
  const earnedWeightedPoints = evaluated.reduce(
    (sum, component) =>
      sum + (Number(component.obtainedMarks) / Number(component.maxMarks))
        * Number(component.weightPercent),
    0
  );
  const currentPercent = evaluatedWeightPercent > 0
    ? roundGpa((earnedWeightedPoints / evaluatedWeightPercent) * 100, 2)
    : null;
  const remainingWeightPercent = Math.max(0, 100 - evaluatedWeightPercent);
  return {
    currentPercent,
    currentGrade: currentPercent == null || !scale
      ? null
      : gradeForPercent(scale, currentPercent)?.letter || null,
    earnedWeightedPoints: roundGpa(earnedWeightedPoints, 4),
    evaluatedWeightPercent: roundGpa(evaluatedWeightPercent, 2),
    remainingWeightPercent: roundGpa(remainingWeightPercent, 2),
  };
}

export function calculateGpa(courses = [], scale, gradeOverrides = {}) {
  if (!scale?.grades?.length) throw new GpaError(503, 'No grading scale is configured.');
  let credits = 0;
  let weightedPoints = 0;

  for (const course of courses) {
    if (!hasGpaCredits(course, scale)) continue;

    const letter = gradeOverrides[course.code] ?? course.currentGrade;
    if (letter == null || letter === '') continue;
    const grade = gradeByLetter(scale, letter);
    const courseCredits = Number(course.credits);
    if (!Number.isFinite(courseCredits) || courseCredits <= 0) continue;

    credits += courseCredits;
    weightedPoints += grade.points * courseCredits;
  }

  return credits > 0
    ? roundGpa(weightedPoints / credits, scale.rounding?.sgpaDecimals ?? 2)
    : null;
}

export function calculatePrediction({
  courses,
  scale,
  predictedGrades = {},
  cumulative,
  includeCumulative = false,
}) {
  const currentGpa = calculateGpa(courses, scale);
  const predictedGpa = calculateGpa(courses, scale, predictedGrades);
  const perCourse = [];

  for (const course of courses) {
    const from = course.currentGrade;
    const to = predictedGrades[course.code] ?? from;
    if (from == null || to == null) continue;
    if (course.isGradeFinal && from !== to) {
      throw new GpaError(422, `${course.code} has a finalized grade and cannot be changed.`);
    }
    const fromGrade = gradeByLetter(scale, from);
    const toGrade = gradeByLetter(scale, to);
    perCourse.push({
      code: course.code,
      from,
      to,
      pointsDelta: roundGpa(toGrade.points - fromGrade.points, 3),
      creditsWeightedImpact: roundGpa(
        (toGrade.points - fromGrade.points) * Number(course.credits || 0),
        3
      ),
    });
  }

  let cumulativeResult = null;
  if (includeCumulative && cumulative?.currentCgpa != null) {
    const completedCredits = Number(cumulative.completedCredits) || 0;
    const predictedPoints = courses.reduce((sum, course) => {
      if (!hasGpaCredits(course, scale)) return sum;
      const letter = predictedGrades[course.code] ?? course.currentGrade;
      if (!letter || Number(course.credits) <= 0) return sum;
      return sum + gradeByLetter(scale, letter).points * Number(course.credits);
    }, 0);
    const currentSemesterPoints = courses.reduce((sum, course) => {
      if (!hasGpaCredits(course, scale) || !course.currentGrade
        || Number(course.credits) <= 0) return sum;
      return sum + gradeByLetter(scale, course.currentGrade).points * Number(course.credits);
    }, 0);
    const currentSemesterCredits = courses.reduce((sum, course) => (
      hasGpaCredits(course, scale) && course.currentGrade && Number(course.credits) > 0
        ? sum + Number(course.credits)
        : sum
    ), 0);
    const predictedSemesterCredits = courses.reduce((sum, course) => (
      hasGpaCredits(course, scale)
        && (predictedGrades[course.code] ?? course.currentGrade)
        && Number(course.credits) > 0
        ? sum + Number(course.credits)
        : sum
    ), 0);
    const completedPoints = Number.isFinite(Number(cumulative.completedPoints))
      ? Number(cumulative.completedPoints)
      : Number(cumulative.currentCgpa) * completedCredits;
    const currentCgpa = roundGpa(
      (completedPoints + currentSemesterPoints) / (completedCredits + currentSemesterCredits),
      scale.rounding?.sgpaDecimals ?? 2
    );
    const predictedCgpa = roundGpa(
      (completedPoints + predictedPoints) / (completedCredits + predictedSemesterCredits),
      scale.rounding?.sgpaDecimals ?? 2
    );
    cumulativeResult = {
      currentCgpa,
      predictedCgpa,
      delta: roundGpa(predictedCgpa - currentCgpa, scale.rounding?.sgpaDecimals ?? 2),
    };
  }

  return {
    currentGpa,
    predictedGpa,
    delta: currentGpa == null || predictedGpa == null
      ? null
      : roundGpa(predictedGpa - currentGpa, scale.rounding?.sgpaDecimals ?? 2),
    perCourse,
    cumulative: cumulativeResult,
    warnings: [],
    disclaimer: 'This is a prediction only and is not an official academic result.',
  };
}

export function requiredScoreForGrade(course, desiredGrade, scale) {
  const grade = gradeByLetter(scale, desiredGrade);
  const remainingWeight = Number(course.remainingWeightPercent) / 100;
  const earned = Number(course.earnedWeightedPoints) || 0;
  if (remainingWeight <= 0) {
    const feasible = earned >= grade.minPercent;
    return {
      code: course.code,
      desiredGrade,
      requiredOnRemaining: feasible ? 0 : null,
      feasible,
      note: feasible ? 'The completed work already meets this grade.' : 'No assessment weight remains.',
    };
  }

  const requiredOnRemaining = roundGpa((grade.minPercent - earned) / remainingWeight, 2);
  const feasible = requiredOnRemaining <= 100;
  return {
    code: course.code,
    desiredGrade,
    requiredOnRemaining: Math.max(0, requiredOnRemaining),
    feasible,
    note: feasible
      ? `Need ${Math.max(0, requiredOnRemaining)}% on the remaining ${course.remainingWeightPercent}% weight.`
      : `Requires ${requiredOnRemaining}% on the remaining work, which exceeds 100%.`,
  };
}

function compareCandidates(left, right, metric) {
  if (metric === 'upgrades') {
    return left.upgrades - right.upgrades
      || left.difficulty - right.difficulty
      || left.balance - right.balance;
  }
  if (metric === 'difficulty') {
    return left.difficulty - right.difficulty
      || left.upgrades - right.upgrades
      || left.balance - right.balance;
  }
  return left.balance - right.balance
    || left.upgrades - right.upgrades
    || left.difficulty - right.difficulty;
}

function currentFloorGrade(course, scale) {
  if (course.earnedWeightedPoints == null) return gradeByLetter(scale, course.currentGrade);
  return gradeForPercent(scale, Number(course.earnedWeightedPoints))
    || scale.grades.reduce((lowest, grade) =>
      grade.points < lowest.points ? grade : lowest, scale.grades[0]);
}

function makeCourseOptions(course, scale, maxGrade, lockedGrade) {
  const current = gradeByLetter(scale, course.currentGrade);
  if (course.isGradeFinal) {
    if (lockedGrade && lockedGrade !== current.letter) {
      throw new GpaError(422, `${course.code} has a finalized grade and is locked to ${current.letter}.`);
    }
    return [current];
  }

  const floor = currentFloorGrade(course, scale);
  const ceiling = maxGrade || scale.grades.reduce((top, grade) =>
    grade.points > top.points ? grade : top, scale.grades[0]);
  const maxPoints = ceiling.points;
  const options = scale.grades.filter((grade) =>
    grade.points >= floor.points && grade.points <= maxPoints
  );

  if (lockedGrade) {
    const locked = gradeByLetter(scale, lockedGrade);
    if (locked.points < floor.points) {
      throw new GpaError(422, `${course.code} cannot be locked below its guaranteed grade floor (${floor.letter}).`);
    }
    return [locked];
  }
  if (!options.length) return [];
  return options;
}

function scoreUnits(grade, credits) {
  return Math.round(Number(grade.points) * Number(credits) * 1000);
}

function planFromCandidate(candidate, courses, scale, targetGpa, totalCredits, label) {
  const gradeByCode = new Map(candidate.choices.map((choice) => [choice.code, choice.grade]));
  const changes = [];
  const requiredPercents = [];

  for (const course of courses) {
    const grade = gradeByCode.get(course.code);
    if (!grade || grade.letter === course.currentGrade) continue;
    changes.push({
      code: course.code,
      from: course.currentGrade,
      to: grade.letter,
      credits: course.credits,
    });
    requiredPercents.push(requiredScoreForGrade(course, grade.letter, scale));
  }

  return {
    label,
    resultingGpa: roundGpa(candidate.score / (1000 * totalCredits), scale.rounding?.sgpaDecimals ?? 2),
    changes,
    requiredPercents,
    target: targetGpa,
  };
}

export function solveTargetGpa({
  courses,
  scale,
  targetGpa,
  lockedGrades = {},
  maxGrade: maxGradeLetter,
  preferCourses = [],
}) {
  const target = Number(targetGpa);
  if (!Number.isFinite(target) || target < scale.minTarget || target > scale.maxTarget) {
    throw new GpaError(400, `Target GPA must be between ${scale.minTarget} and ${scale.maxTarget}.`);
  }
  const eligible = courses.filter((course) =>
    course.currentGrade && course.gradingType !== 'passFail'
      && course.gradingType !== 'audit' && course.gradeStatus !== 'withdrawn'
  );
  if (!eligible.length) throw new GpaError(422, 'No graded courses are available for target solving.');
  if (eligible.some((course) => Number(course.credits) <= 0)) {
    throw new GpaError(422, 'Target solving requires positive course credits.');
  }
  const totalCredits = eligible.reduce((sum, course) => sum + Number(course.credits), 0);
  if (totalCredits <= 0) throw new GpaError(422, 'Target solving requires positive total credits.');

  const maxGrade = maxGradeLetter ? gradeByLetter(scale, maxGradeLetter) : null;
  const optionsByCourse = eligible.map((course) => {
    const lock = lockedGrades[course.code];
    return {
      course,
      options: makeCourseOptions(course, scale, maxGrade, lock),
    };
  });
  for (const { course, options } of optionsByCourse) {
    if (!options.length) {
      throw new GpaError(422, `${course.code} cannot reach the selected maximum grade.`);
    }
  }

  const currentTotalPoints = eligible.reduce(
    (sum, course) =>
      sum + gradeByLetter(scale, course.currentGrade).points * Number(course.credits),
    0
  );
  const maxPossibleTotalPoints = optionsByCourse.reduce((sum, item) => {
    const top = item.options.reduce((best, grade) => grade.points > best.points ? grade : best);
    return sum + top.points * Number(item.course.credits);
  }, 0);
  const decimals = scale.rounding?.sgpaDecimals ?? 2;
  const threshold = target - (0.5 / (10 ** decimals));
  const requiredTotalPoints = target * totalCredits;
  const requiredUnits = Math.ceil(threshold * totalCredits * 1000 - 1e-8);
  const metrics = ['upgrades', 'difficulty', 'balance'];
  const initial = {
    upgrades: 0,
    difficulty: 0,
    balance: 0,
    score: 0,
    choices: [],
  };
  let states = new Map([[0, {
    upgrades: initial,
    difficulty: initial,
    balance: initial,
  }]]);

  for (const { course, options } of optionsByCourse) {
    const next = new Map();
    for (const state of states.values()) {
      for (const metric of metrics) {
        const candidate = state[metric];
        for (const grade of options) {
          const score = candidate.score + scoreUnits(grade, course.credits);
          const changed = grade.letter !== course.currentGrade;
          const minPercent = grade.minPercent || 0;
          const remaining = Math.max(0, Number(course.remainingWeightPercent) || 0);
          const gap = Math.max(0, minPercent - (Number(course.currentPercent) || 0));
          const preferredIndex = preferCourses.indexOf(course.code);
          const preferencePenalty = preferredIndex < 0
            ? 1
            : (preferredIndex + 1) / (preferCourses.length + 1);
          const choice = {
            code: course.code,
            grade,
            impact: (grade.points - Number(course.currentGradePoints)) * Number(course.credits),
          };
          const expanded = {
            score,
            upgrades: candidate.upgrades + (changed ? 1 : 0),
            difficulty: candidate.difficulty + (changed ? gap * remaining * preferencePenalty : 0),
            balance: candidate.balance + (changed ? choice.impact ** 2 : 0),
            choices: [...candidate.choices, choice],
          };
          const existing = next.get(score) || {};
          if (!existing[metric] || compareCandidates(expanded, existing[metric], metric) < 0) {
            existing[metric] = expanded;
          }
          next.set(score, existing);
        }
      }
    }
    states = next;
  }

  const candidatesByMetric = Object.fromEntries(metrics.map((metric) => [
    metric,
    [...states.values()].map((state) => state[metric]).filter(Boolean),
  ]));
  const allCandidates = metrics.flatMap((metric) => candidatesByMetric[metric]);
  const bestAvailable = allCandidates.reduce(
    (best, item) => item.score > best.score ? item : best
  );
  const feasible = bestAvailable.score >= requiredUnits;
  let suggestedPlans;
  if (!feasible) {
    suggestedPlans = [
      planFromCandidate(bestAvailable, eligible, scale, target, totalCredits, 'Highest achievable GPA'),
    ];
  } else {
    const distinct = new Set();
    suggestedPlans = metrics.map((metric, index) => {
      const best = candidatesByMetric[metric]
        .filter((candidate) => candidate.score >= requiredUnits)
        .sort((left, right) =>
          left.score - right.score
          || compareCandidates(left, right, metric)
        )[0];
      return planFromCandidate(
        best,
        eligible,
        scale,
        target,
        totalCredits,
        ['Fewest grade upgrades', 'Easiest courses', 'Balanced plan'][index]
      );
    }).filter((plan) => {
      const key = JSON.stringify(plan.changes.map((change) => [change.code, change.to]));
      if (distinct.has(key)) return false;
      distinct.add(key);
      return true;
    });
  }

  return {
    target,
    requiredTotalPoints: roundGpa(requiredTotalPoints, 3),
    maxPossibleTotalPoints: roundGpa(maxPossibleTotalPoints, 3),
    currentTotalPoints: roundGpa(currentTotalPoints, 3),
    isFeasible: feasible,
    achievableMax: roundGpa(bestAvailable.score / (1000 * totalCredits), decimals),
    suggestedPlans,
    message: feasible
      ? `The target GPA of ${target} is achievable with the plans shown.`
      : `The target GPA of ${target} is not reachable; the highest achievable GPA is ${roundGpa(bestAvailable.score / (1000 * totalCredits), decimals)}.`,
    disclaimer: 'These are projections only and are not official academic results.',
  };
}

export function generateGpaInsights({
  courses,
  scale,
  attendanceThreshold = 75,
  targetGpa,
}) {
  const graded = courses.filter((course) => course.currentGrade && Number(course.credits) > 0);
  if (!graded.length) return [];
  const insights = [];
  const byCreditAndHeadroom = [...graded].sort((left, right) =>
    Number(right.credits) * Math.max(0, Number(scale.maxPoints) - Number(right.currentGradePoints))
    - Number(left.credits) * Math.max(0, Number(scale.maxPoints) - Number(left.currentGradePoints))
  );
  const focus = byCreditAndHeadroom[0];
  if (focus && Number(focus.currentGradePoints) < Number(scale.maxPoints)) {
    insights.push({
      type: 'focus',
      title: 'Focus on the highest-impact opportunity',
      text: `${focus.code} has ${focus.credits} credits and the greatest remaining grade-point headroom.`,
      courseCodes: [focus.code],
      priority: 1,
    });
  }

  const atRisk = graded.filter((course) => {
    const boundaryRisk = scale.grades.some((grade) =>
      grade.minPercent > 0
      && Number(course.currentPercent) >= grade.minPercent
      && Number(course.currentPercent) - grade.minPercent <= 2
    );
    const attendanceRisk = course.attendancePercent != null
      && Number(course.attendancePercent) < attendanceThreshold;
    return boundaryRisk || attendanceRisk;
  });
  if (atRisk.length) {
    insights.push({
      type: 'risk',
      title: 'Monitor course risks',
      text: `${atRisk.map((course) => course.code).join(', ')} is near a grade boundary or below the ${attendanceThreshold}% attendance threshold.`,
      courseCodes: atRisk.map((course) => course.code),
      priority: 2,
    });
  }

  const strongest = [...graded].sort((left, right) =>
    Number(right.currentGradePoints) - Number(left.currentGradePoints)
  )[0];
  if (strongest) {
    insights.push({
      type: 'maintain',
      title: 'Maintain your strongest performance',
      text: `${strongest.code} currently has your strongest grade; keep its remaining assessments on track.`,
      courseCodes: [strongest.code],
      priority: 3,
    });
  }

  const totalCredits = graded.reduce((sum, course) => sum + Number(course.credits), 0);
  const creditGroups = new Map();
  for (const course of graded) {
    const credits = Number(course.credits);
    creditGroups.set(credits, (creditGroups.get(credits) || 0) + credits);
  }
  const largestCreditGroup = [...creditGroups.entries()].sort((a, b) => b[1] - a[1])[0];
  if (largestCreditGroup && totalCredits > 0) {
    const share = roundGpa((largestCreditGroup[1] / totalCredits) * 100, 1);
    insights.push({
      type: 'credit-impact',
      title: 'Understand credit weighting',
      text: `${largestCreditGroup[0]}-credit courses account for ${share}% of graded course credits.`,
      courseCodes: graded
        .filter((course) => Number(course.credits) === largestCreditGroup[0])
        .map((course) => course.code),
      priority: 4,
    });
  }
  if (targetGpa != null) {
    const current = calculateGpa(graded, scale);
    insights.push({
      type: 'focus',
      title: 'Saved target GPA',
      text: `Your current GPA is ${current}; the saved target is ${targetGpa}, a gap of ${roundGpa(Number(targetGpa) - current, 2)} points.`,
      courseCodes: [],
      priority: 5,
    });
  }

  return insights;
}
