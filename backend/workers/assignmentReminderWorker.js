import { Assignment, CourseEnrollment, Student, Submission } from '../models.js';
import { createAssignmentReminder } from '../services/assignmentService.js';

const SCAN_INTERVAL_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
let scanInProgress = false;

function reminderTypeFor(dueDate, now) {
  const remaining = new Date(dueDate).getTime() - now.getTime();
  if (remaining <= 0) return 'overdue';
  if (remaining <= ONE_HOUR_MS) return '1h';
  if (remaining <= ONE_DAY_MS) return '24h';
  return null;
}

export async function scanAssignmentReminders(now = new Date()) {
  if (scanInProgress) return { scanned: 0, sent: 0 };
  scanInProgress = true;
  try {
    const cursor = Assignment.find({
      source: 'faculty',
      lifecycleStatus: { $in: ['published', null] },
      deletedAt: null,
      dueDate: { $lte: new Date(now.getTime() + ONE_DAY_MS) },
    }).select('_id title courseId dueDate').lean().cursor({ batchSize: 100 });
    let sent = 0;
    let scanned = 0;
    for await (const assignment of cursor) {
      scanned += 1;
      const type = reminderTypeFor(assignment.dueDate, now);
      if (!type) continue;
      const studentIds = await CourseEnrollment.find({ courseId: assignment.courseId }).distinct('studentId');
      if (!studentIds.length) continue;
      const submittedStudentIds = await Submission.find({
        assignmentId: assignment._id,
        status: { $in: ['submitted', 'late', 'graded'] },
      }).distinct('studentId');
      const completed = new Set(submittedStudentIds.map(String));
      const students = await Student.find({
        _id: { $in: studentIds.filter((studentId) => !completed.has(String(studentId))) },
      }).select('_id userId').lean();
      for (const student of students) {
        if (await createAssignmentReminder(assignment, student, type, now)) sent += 1;
      }
    }
    return { scanned, sent };
  } finally {
    scanInProgress = false;
  }
}

export function startAssignmentReminderWorker() {
  const run = () => {
    scanAssignmentReminders().catch(() => {
      console.error('[Assignment reminders] The scheduled reminder scan failed.');
    });
  };
  run();
  const timer = setInterval(run, SCAN_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
