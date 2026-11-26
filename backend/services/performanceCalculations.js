export function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function gradedWithCredits(enrollments, gradePolicy = {}) {
  return enrollments.filter((entry) =>
    (entry.gradeStatus !== 'withdrawn' || gradePolicy.withdrawalPolicy === 'include')
    && (entry.gradeStatus !== 'incomplete' || gradePolicy.incompletePolicy === 'include')
    && entry.gradePoint != null
    && entry.credits != null
    && Number.isFinite(Number(entry.gradePoint))
    && Number.isFinite(Number(entry.credits))
    && Number(entry.credits) > 0
  );
}

function selectLatestAttempts(enrollments) {
  const latest = new Map();
  for (const entry of enrollments) {
    const key = String(entry.courseId || entry._id || '');
    const previous = latest.get(key);
    const entryOrder = [Number(entry.semesterNumber) || 0, Number(entry.attempt) || 0, new Date(entry.updatedAt || 0).getTime()];
    const previousOrder = previous
      ? [Number(previous.semesterNumber) || 0, Number(previous.attempt) || 0, new Date(previous.updatedAt || 0).getTime()]
      : null;
    if (!previous || entryOrder.some((value, index) =>
      value > previousOrder[index] && entryOrder.slice(0, index).every((part, prior) => part === previousOrder[prior])
    )) latest.set(key, entry);
  }
  return [...latest.values()];
}

export function gpaForEnrollments(enrollments, gradePolicy = {}) {
  const valid = gradedWithCredits(enrollments, gradePolicy);
  const credits = valid.reduce((sum, entry) => sum + Number(entry.credits), 0);
  if (credits <= 0) return { gpa: null, credits: 0 };
  const weightedPoints = valid.reduce(
    (sum, entry) => sum + Number(entry.gradePoint) * Number(entry.credits),
    0
  );
  return { gpa: round(weightedPoints / credits), credits };
}

export function calculateSemesterMetrics(enrollments, repeatPolicy = 'latest', gradePolicy = {}) {
  const bySemester = new Map();
  for (const entry of enrollments) {
    const semesterNumber = Number(entry.semesterNumber);
    if (!Number.isInteger(semesterNumber)) continue;
    if (!bySemester.has(semesterNumber)) bySemester.set(semesterNumber, []);
    bySemester.get(semesterNumber).push(entry);
  }

  const ordered = [...bySemester.entries()].sort(([a], [b]) => a - b);
  const cumulative = [];
  return ordered.map(([semesterNumber, entries]) => {
    const eligibleEntries = gradedWithCredits(entries, gradePolicy);
    const latestWithinSemester = repeatPolicy === 'latest' ? selectLatestAttempts(eligibleEntries) : eligibleEntries;
    const semester = gpaForEnrollments(latestWithinSemester, gradePolicy);
    cumulative.push(...eligibleEntries);
    const cumulativeRecords = repeatPolicy === 'latest' ? selectLatestAttempts(cumulative) : cumulative;
    return {
      semesterNumber,
      sgpa: semester.gpa,
      credits: semester.credits,
      cgpa: gpaForEnrollments(cumulativeRecords, gradePolicy).gpa,
    };
  });
}

export function weightedAverage(items, valueKey, weightKey) {
  const eligible = items.filter((item) =>
    item[valueKey] != null
    && item[weightKey] != null
    && Number.isFinite(Number(item[valueKey]))
    && Number.isFinite(Number(item[weightKey]))
    && Number(item[weightKey]) > 0
  );
  const totalWeight = eligible.reduce((sum, item) => sum + Number(item[weightKey]), 0);
  if (totalWeight === 0) return null;
  return round(
    eligible.reduce((sum, item) => sum + Number(item[valueKey]) * Number(item[weightKey]), 0) / totalWeight,
    1
  );
}

export function unweightedAverage(values) {
  const eligible = values.filter((value) => value != null && Number.isFinite(Number(value)));
  if (!eligible.length) return null;
  return round(eligible.reduce((sum, value) => sum + Number(value), 0) / eligible.length, 1);
}

export function percentileForStudent(cohortAverages, studentId, studentAverage, privacyThreshold = 5) {
  if (studentAverage == null || cohortAverages.length < privacyThreshold) return null;
  const peers = cohortAverages.filter((entry) => String(entry.studentId) !== String(studentId));
  if (!peers.length) return null;
  const belowCount = peers.filter((entry) => Number(entry.average) < studentAverage).length;
  return round((belowCount / peers.length) * 100, 0);
}

export function cohortMeetsPrivacyThreshold(submissionCount, privacyThreshold) {
  return Number(submissionCount) >= Number(privacyThreshold);
}

export function topPercentLabel(percentile) {
  if (percentile == null) return null;
  const top = Math.max(5, Math.min(100, 100 - percentile));
  const bucket = Math.min(100, Math.ceil(top / 5) * 5);
  return `Top ${bucket}%`;
}

export function onTimePercentage(submissions) {
  const submitted = submissions.filter((submission) =>
    ['submitted', 'graded', 'late'].includes(String(submission.status || '').toLowerCase())
  );
  if (!submitted.length) return null;
  const onTime = submitted.filter((submission) => submission.submittedOnTime === true).length;
  return round((onTime / submitted.length) * 100, 1);
}
