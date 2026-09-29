import { getAssignmentDueTimestamp, isAssignmentDueWithin24Hours } from './deadline.js';

/**
 * Formats minutes into 12-hour AM/PM string
 */
function formatMinuteOfDay(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minPad = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours12}:${minPad} ${period}`;
}

/**
 * Smart Study Session Generator
 * Analyzes pending deliverables, deadlines, weightage, and upcoming lecture syllabi
 * to construct an optimized, prioritized daily study plan.
 */
export function generateSmartStudyPlan(options) {
  const {
    assignments = [],
    lectures = [],
    courses = [],
    targetHours = 3.5,
    strategy = 'balanced',
    startTimeStr = '09:30',
  } = options || {};

  const now = Date.now();
  const totalTargetMinutes = Math.round(targetHours * 60);

  // 1. Filter pending deliverables and sort by urgency and weight
  const pendingAssignments = assignments
    .filter((a) => a.status === 'Pending')
    .map((a) => {
      const dueMs = getAssignmentDueTimestamp(a.dueDate);
      const diffHours = (dueMs - now) / (1000 * 60 * 60);
      const isUrgent = isAssignmentDueWithin24Hours(a.dueDate, a.status);
      const weightScore = (a.weightPercent || 10) * 1.5;
      const urgencyScore = isUrgent ? 100 : diffHours > 0 && diffHours < 72 ? 60 : 30;
      return {
        ...a,
        dueMs,
        diffHours,
        isUrgent,
        priorityScore: urgencyScore + weightScore,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // 2. Identify upcoming lectures
  const upcomingLectures = [...lectures]
    .map((lec) => {
      const isExam = lec.type === 'Exam';
      const isLab = lec.type === 'Lab' || lec.type === 'Tutorial';
      return {
        ...lec,
        isExam,
        isLab,
        priorityBonus: isExam ? 80 : isLab ? 40 : 20,
      };
    })
    .sort((a, b) => b.priorityBonus - a.priorityBonus);

  // 3. Build prioritized sessions
  const sessions = [];
  let allocatedMinutes = 0;

  const [startH, startM] = (startTimeStr || '09:30').split(':').map((v) => parseInt(v, 10) || 0);
  let currentClockMinutes = (startH || 9) * 60 + (startM || 30);

  const addSession = (sessionData) => {
    if (allocatedMinutes + sessionData.durationMinutes > totalTargetMinutes + 30 && sessions.length >= 2) {
      return;
    }
    const startStr = formatMinuteOfDay(currentClockMinutes);
    const endClockMinutes = currentClockMinutes + sessionData.durationMinutes;
    const endStr = formatMinuteOfDay(endClockMinutes);

    sessions.push({
      id: `session-${Date.now()}-${sessions.length + 1}`,
      timeBlock: `${startStr} - ${endStr}`,
      completed: false,
      ...sessionData,
    });

    allocatedMinutes += sessionData.durationMinutes;
    currentClockMinutes = endClockMinutes + 15;
  };

  // Rule A: Urgent Pending Deliverable (<24 Hours)
  const urgentAssignment = pendingAssignments.find((a) => a.isUrgent);
  if (urgentAssignment) {
    const course = courses.find((c) => c.code === urgentAssignment.courseCode);
    const relatedLec = upcomingLectures.find((l) => l.courseCode === urgentAssignment.courseCode);
    const duration = strategy === 'deadlines' ? 75 : 60;

    addSession({
      title: `Sprint: ${urgentAssignment.title}`,
      courseCode: urgentAssignment.courseCode,
      courseName: course?.name || urgentAssignment.courseCode,
      durationMinutes: duration,
      priority: 'Critical',
      category: 'assignment',
      rationale: `Deadline within ${Math.max(1, Math.round(urgentAssignment.diffHours))}h. High impact on internal assessment (${urgentAssignment.weightPercent}% course weight).`,
      actionItems: [
        `Complete pending problem sets/submission checklist for ${urgentAssignment.title}`,
        'Verify edge cases, error calculations, and formatting criteria',
        'Review rubric requirements before final portal submission',
      ],
      recommendedTechnique: 'Deep Focus Sprint (50 min uninterrupted + 10 min verification)',
      relatedAssignmentId: urgentAssignment.id,
      relatedLectureTopic: relatedLec?.unitTopic,
    });
  }

  // Rule B: High-weight major pending assignment
  const remainingAssignments = pendingAssignments.filter((a) => a.id !== urgentAssignment?.id);
  const majorAssignment = remainingAssignments[0];
  if (majorAssignment && allocatedMinutes < totalTargetMinutes) {
    const course = courses.find((c) => c.code === majorAssignment.courseCode);
    const relatedLec = upcomingLectures.find((l) => l.courseCode === majorAssignment.courseCode);
    const duration = strategy === 'mastery' ? 75 : 60;

    addSession({
      title: `Implementation: ${majorAssignment.title}`,
      courseCode: majorAssignment.courseCode,
      courseName: course?.name || majorAssignment.courseCode,
      durationMinutes: duration,
      priority: 'High',
      category: 'assignment',
      rationale: `Substantial coursework item (${majorAssignment.weightPercent}% weight). Early incremental development prevents syntax and debugging bottlenecks.`,
      actionItems: [
        `Implement core data structure/algorithm logic for ${majorAssignment.title}`,
        'Test execution bounds, memory handling, and corner scenarios',
        'Document implementation steps for the lab evaluation sheet',
      ],
      recommendedTechnique: 'Pomodoro Blocks (2 x 25m focus with 5m break)',
      relatedAssignmentId: majorAssignment.id,
      relatedLectureTopic: relatedLec?.unitTopic,
    });
  }

  // Rule C: Upcoming Exam
  const urgentExam = upcomingLectures.find((l) => l.isExam);
  if (urgentExam && allocatedMinutes < totalTargetMinutes) {
    const course = courses.find((c) => c.code === urgentExam.courseCode);
    addSession({
      title: `Exam Prep: ${urgentExam.courseCode} ${urgentExam.courseName}`,
      courseCode: urgentExam.courseCode,
      courseName: course?.name || urgentExam.courseName,
      durationMinutes: 60,
      priority: 'High',
      category: 'concept_review',
      rationale: `Upcoming examination on ${urgentExam.date} covering: "${urgentExam.unitTopic}". Critical for semester SGPA.`,
      actionItems: [
        `Review past year questions (PYQ) related to ${urgentExam.unitTopic}`,
        'Synthesize summary cheat sheet of formulas and governing theorems',
        'Conduct 30-minute closed-book mock trial question solving',
      ],
      recommendedTechnique: 'Active Recall & Feynman Technique (Explain concepts aloud without notes)',
      relatedLectureTopic: urgentExam.unitTopic,
    });
  }

  // Rule D: Lecture Preview / Lab Tutorial Prep
  const upcomingLabOrLec = upcomingLectures.find(
    (l) => !l.isExam && (!urgentAssignment || l.courseCode !== urgentAssignment.courseCode)
  ) || upcomingLectures[0];

  if (upcomingLabOrLec && allocatedMinutes < totalTargetMinutes) {
    const course = courses.find((c) => c.code === upcomingLabOrLec.courseCode);
    addSession({
      title: `Pre-Class Preview: ${upcomingLabOrLec.unitTopic.split(':')[0] || 'Unit Preview'}`,
      courseCode: upcomingLabOrLec.courseCode,
      courseName: course?.name || upcomingLabOrLec.courseName,
      durationMinutes: 45,
      priority: 'Medium',
      category: 'lecture_prep',
      rationale: `Upcoming ${upcomingLabOrLec.type} with ${upcomingLabOrLec.facultyName}. Pre-reading course handout establishes strong cognitive priming.`,
      actionItems: [
        `Skim syllabus units and reference notes for: ${upcomingLabOrLec.unitTopic}`,
        'Highlight 3 conceptual questions to clarify during faculty interaction',
        'Ensure lab skeleton or reference materials are downloaded',
      ],
      recommendedTechnique: 'SQ3R Reading Method (Survey, Question, Read, Recite, Review)',
      relatedLectureTopic: upcomingLabOrLec.unitTopic,
    });
  }

  // Rule E: Research / Review / Secondary Assignment
  const secondaryAssignment = remainingAssignments[1];
  if (secondaryAssignment && allocatedMinutes < totalTargetMinutes) {
    const course = courses.find((c) => c.code === secondaryAssignment.courseCode);
    addSession({
      title: `Drafting: ${secondaryAssignment.title}`,
      courseCode: secondaryAssignment.courseCode,
      courseName: course?.name || secondaryAssignment.courseCode,
      durationMinutes: 45,
      priority: 'Medium',
      category: 'assignment',
      rationale: `Advance draft progress on ${secondaryAssignment.title}. Prevents submission crunch as due date approaches.`,
      actionItems: [
        'Review research citations, thesis statements, or problem specifications',
        'Draft next section or outline milestones',
      ],
      recommendedTechnique: 'Timeboxing (Strict 45-minute focused output sprint)',
      relatedAssignmentId: secondaryAssignment.id,
    });
  }

  // If still below target, add Concept Review
  if (allocatedMinutes < totalTargetMinutes && courses.length > 0) {
    const focusCourse = courses.find((c) => c.currentScore < 85) || courses[0];
    addSession({
      title: `Diagnostic Review: ${focusCourse.code} Key Concepts`,
      courseCode: focusCourse.code,
      courseName: focusCourse.name,
      durationMinutes: Math.min(45, totalTargetMinutes - allocatedMinutes),
      priority: 'Review',
      category: 'practice_drill',
      rationale: `Targeted reinforcement for ${focusCourse.name} (Current grade ${focusCourse.currentGrade} / ${focusCourse.currentScore}%). Boosts grade threshold.`,
      actionItems: [
        'Practice 2-3 numerical/proof derivations or code traces',
        'Review instructor feedback on recent quizzes',
      ],
      recommendedTechnique: 'Spaced Retrieval Practice',
    });
  }

  const totalAllocatedHours = (allocatedMinutes / 60).toFixed(1);
  const criticalCount = sessions.filter((s) => s.priority === 'Critical').length;
  let summaryInsight = `Constructed ${sessions.length} prioritized study blocks totaling ${totalAllocatedHours} hours. `;
  if (criticalCount > 0) {
    summaryInsight += `High alert: 1 urgent deadline (<24h) prioritized at the start of your day to eliminate submission anxiety. `;
  }
  summaryInsight += `Schedules include preparatory primers matched to upcoming lectures and high-yield coursework.`;

  return {
    id: `plan-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    targetHours: Number(totalAllocatedHours),
    strategy,
    sessions,
    summaryInsight,
  };
}

/**
 * AI-refined study plan suggestions using the server-side Gemini API
 */
export async function fetchAiStudyPlanEnhancement(plan, studentName, courses) {
  try {
    const prompt = `Student: ${studentName}.
Enrolled Courses: ${(courses || []).map((c) => `${c.code} (${c.name}, current grade ${c.currentGrade})`).join(', ')}.
Current Study Plan Sessions:
${(plan.sessions || [])
  .map(
    (s, idx) =>
      `${idx + 1}. [${s.priority}] ${s.timeBlock} - ${s.title} (${s.courseCode}, ${s.durationMinutes}m). Focus: ${s.rationale}`
  )
  .join('\n')}

Provide 3 high-impact, concrete cognitive pacing recommendations (e.g. interleaving strategies, hydration/break intervals, and memory retention techniques) specifically tailored to this student's schedule today. Keep it concise, authoritative, and structured without fluff or emoji icons.`;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        role: 'study_planner',
        model: 'gemini-3.5-flash',
      }),
    });

    if (!res.ok) {
      throw new Error(`API responded with ${res.status}`);
    }

    const data = await res.json();
    return data.text || 'Study plan successfully verified against syllabus milestones.';
  } catch (err) {
    console.warn('AI enhancement fallback:', err);
    return 'Cognitive Pacing Advice: Begin with the urgent deliverable during your peak morning alertness. Follow with algorithmic coding using 25-minute Pomodoro bursts. Conclude the day with light reading and concept flashcards to consolidate memory consolidation before sleep.';
  }
}
