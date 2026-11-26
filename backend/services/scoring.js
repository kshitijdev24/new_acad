import { SCORE_LEVELS, SCORE_WEIGHTS } from '../config/scoring.js';

const idOf = (value) => String(
  value?._id ??
  (typeof value?.toHexString === 'function' ? value.toHexString() : value?.id ?? value)
);

function calculateTrend(years, currentYear) {
  const appearancesByYear = new Map();
  for (const year of years) {
    appearancesByYear.set(year, (appearancesByYear.get(year) || 0) + 1);
  }
  const chronological = [...appearancesByYear.entries()].sort((a, b) => a[0] - b[0]);
  if (chronological.length < 3) return 'stable';

  const recent = chronological.slice(-2).reduce((sum, [, count]) => sum + count, 0) / 2;
  const earlier = chronological.slice(0, -2).reduce((sum, [, count]) => sum + count, 0) /
    (chronological.length - 2);
  if (recent > earlier * 1.2) return 'rising';
  if (recent < earlier * 0.8 && currentYear >= chronological.at(-1)[0]) return 'falling';
  return 'stable';
}

function scoreGroups(groups, currentYear) {
  const maxMarks = Math.max(0, ...groups.map((group) => group.totalMarks));
  const maxFrequency = Math.max(0, ...groups.map((group) => group.paperIds.size));
  const maxSyllabusWeight = Math.max(0, ...groups.map((group) => group.syllabusWeight));
  const totalSyllabusWeight = groups.reduce((sum, group) => sum + group.syllabusWeight, 0);
  const maxGap = Math.max(1, ...groups.map((group) => group.lastYear ? Math.max(0, currentYear - group.lastYear) : 0));
  const maxRecency = Math.max(
    0,
    ...groups.map((group) =>
      [...group.years].reduce((sum, year) => sum + 0.8 ** Math.max(0, currentYear - year), 0)
    )
  );
  const allMarks = groups.reduce((sum, group) => sum + group.totalMarks, 0);

  return groups.map((group) => {
    const frequency = group.paperIds.size;
    const yearsAppeared = [...group.years].sort((a, b) => a - b);
    const gapYears = group.lastYear ? Math.max(0, currentYear - group.lastYear) : currentYear;
    const marksPercent = allMarks ? (group.totalMarks / allMarks) * 100 : 0;
    const normalizedMarksWeight = maxMarks ? group.totalMarks / maxMarks : 0;
    const normalizedFrequency = maxFrequency ? frequency / maxFrequency : 0;
    const recency = [...group.years].reduce(
      (sum, year) => sum + 0.8 ** Math.max(0, currentYear - year),
      0
    );
    const recencyWeightedPresence = maxRecency ? recency / maxRecency : 0;
    const gapDueFactor = normalizedFrequency * Math.min(gapYears / maxGap, 1);
    const syllabusWeight = maxSyllabusWeight ? group.syllabusWeight / maxSyllabusWeight : 0;
    const importanceScore = Math.round(
      100 * (
        SCORE_WEIGHTS.marks * normalizedMarksWeight +
        SCORE_WEIGHTS.frequency * normalizedFrequency +
        SCORE_WEIGHTS.recency * recencyWeightedPresence +
        SCORE_WEIGHTS.gap * gapDueFactor +
        SCORE_WEIGHTS.syllabus * syllabusWeight
      )
    );
    const level = importanceScore >= SCORE_LEVELS.high
      ? 'high'
      : importanceScore >= SCORE_LEVELS.medium
        ? 'medium'
        : 'low';
    const expectedMarksPercent = totalSyllabusWeight
      ? group.syllabusWeight / totalSyllabusWeight * 100
      : 0;
    const tags = [];
    if (marksPercent > expectedMarksPercent * 1.25) tags.push('Most Scoring');
    if (level === 'high' && group.lastYear && currentYear - group.lastYear <= 2) {
      tags.push('Must Study');
    }
    if (gapYears >= 3 && normalizedFrequency >= 0.5) tags.push('Due Soon');

    return {
      id: group.id,
      unitId: group.unitId,
      frequency,
      yearsAppeared,
      totalMarks: Number(group.totalMarks.toFixed(2)),
      marksPercent: Number(marksPercent.toFixed(2)),
      lastYearAppeared: group.lastYear || null,
      gapYears,
      trend: calculateTrend(
        group.appearanceYears.length ? group.appearanceYears : yearsAppeared,
        currentYear
      ),
      importanceScore,
      level,
      tags,
      reason: `Appeared in ${yearsAppeared.length} of ${group.subjectYears.length} uploaded years; ${group.totalMarks.toFixed(1)} marks across ${frequency} papers, last asked ${group.lastYear || 'not yet'}.`,
    };
  });
}

export function calculateImportance({ units = [], topics = [], questions = [], currentYear = new Date().getFullYear() }) {
  const allYears = [...new Set(questions.map((question) => Number(question.year)).filter(Number.isFinite))];
  const subjectYears = allYears.length || questions.length
    ? allYears
    : [currentYear];
  const topicGroups = new Map(topics.map((topic) => [idOf(topic), {
    id: idOf(topic),
    unitId: idOf(topic.unitId),
    syllabusWeight: Number(topic.syllabusWeight ?? 1),
    totalMarks: 0,
    paperIds: new Set(),
    years: new Set(),
    appearanceYears: [],
    lastYear: null,
    subjectYears,
  }]));
  const unitGroups = new Map(units.map((unit) => [idOf(unit), {
    id: idOf(unit),
    unitId: idOf(unit),
    syllabusWeight: Number(unit.syllabusWeight ?? 1),
    totalMarks: 0,
    paperIds: new Set(),
    years: new Set(),
    appearanceYears: [],
    lastYear: null,
    subjectYears,
  }]));

  for (const question of questions) {
    const questionYear = Number(question.year);
    const paperId = idOf(question.paperId);
    const topicIds = [...new Set((question.topicIds || []).map(idOf))];
    for (const topicId of topicIds) {
      const group = topicGroups.get(topicId);
      if (!group) continue;
      group.totalMarks += Number(question.marks) || 0;
      group.paperIds.add(paperId);
      if (Number.isFinite(questionYear)) {
        group.years.add(questionYear);
        group.appearanceYears.push(questionYear);
        group.lastYear = Math.max(group.lastYear || questionYear, questionYear);
      }
      const unitGroup = unitGroups.get(group.unitId);
      if (unitGroup) {
        unitGroup.totalMarks += Number(question.marks) || 0;
        unitGroup.paperIds.add(paperId);
        if (Number.isFinite(questionYear)) {
          unitGroup.years.add(questionYear);
          unitGroup.appearanceYears.push(questionYear);
          unitGroup.lastYear = Math.max(unitGroup.lastYear || questionYear, questionYear);
        }
      }
    }
  }

  const topicStats = scoreGroups([...topicGroups.values()], currentYear);
  const unitStats = scoreGroups([...unitGroups.values()], currentYear);
  const topicMarks = topicStats.reduce((sum, topic) => sum + topic.totalMarks, 0);
  const unitMarks = unitStats.reduce((sum, unit) => sum + unit.totalMarks, 0);

  return {
    topicStats: topicStats.map((stat) => ({ ...stat, marksPercent: topicMarks ? stat.totalMarks / topicMarks * 100 : 0 })),
    unitStats: unitStats.map((stat) => ({ ...stat, marksPercent: unitMarks ? stat.totalMarks / unitMarks * 100 : 0 })),
  };
}
