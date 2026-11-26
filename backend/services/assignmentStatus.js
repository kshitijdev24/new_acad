import { StudentAssignmentState, Submission } from '../models.js';

const DAY_SECONDS = 24 * 60 * 60;
const completedSubmissionStatuses = ['submitted', 'late', 'graded'];

export function deriveAssignmentStatus({
  dueDate,
  source = 'faculty',
  submission = null,
  manualCompleted = false,
  now = new Date(),
}) {
  const dueAt = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const nowAt = now instanceof Date ? now : new Date(now);
  const differenceMs = dueAt.getTime() - nowAt.getTime();
  const completed = completedSubmissionStatuses.includes(submission?.status)
    || (source === 'personal' && manualCompleted);
  const status = completed
    ? 'Completed'
    : nowAt.getTime() > dueAt.getTime()
      ? 'Overdue'
      : 'Pending';
  const isDueSoon = status === 'Pending'
    && differenceMs >= 0
    && differenceMs <= DAY_SECONDS * 1000;

  return {
    status,
    isDueSoon,
    dueInSeconds: status === 'Pending' ? Math.ceil(differenceMs / 1000) : null,
  };
}

function localDateTimeToUtc(year, month, day, hour, minute, timeZone) {
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 59, 999);
  let candidate = targetAsUtc;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)])
    );
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      new Date(candidate).getUTCMilliseconds()
    );
    candidate += targetAsUtc - representedAsUtc;
  }
  return new Date(candidate);
}

export function parseAssignmentDueDate(value, {
  timeZone = process.env.ASSIGNMENT_TIMEZONE || 'Asia/Kolkata',
  endOfDay = process.env.ASSIGNMENT_DUE_TIME || '23:59',
} = {}) {
  if (typeof value !== 'string') throw new TypeError('A due date is required.');

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const calendarCheck = new Date(Date.UTC(year, month - 1, day));
    if (
      calendarCheck.getUTCFullYear() !== year
      || calendarCheck.getUTCMonth() !== month - 1
      || calendarCheck.getUTCDate() !== day
    ) {
      throw new TypeError('Enter a valid calendar date.');
    }

    const cutoff = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(endOfDay);
    if (!cutoff) throw new TypeError('ASSIGNMENT_DUE_TIME must use HH:mm format.');
    return localDateTimeToUtc(
      year,
      month,
      day,
      Number(cutoff[1]),
      Number(cutoff[2]),
      timeZone
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new TypeError('Use a date-only value or an ISO timestamp with a timezone.');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new TypeError('Enter a valid due date.');
  return parsed;
}

export function assignmentStatusStages(studentId, now = new Date()) {
  const studentObjectId = studentId;
  const assignmentId = '$_id';
  const dueDateExpression = {
    $convert: { input: '$dueDate', to: 'date', onError: null, onNull: null },
  };

  return [
    {
      $lookup: {
        from: Submission.collection.name,
        let: { assignmentId },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$assignmentId', '$$assignmentId'] },
                  { $eq: ['$studentId', studentObjectId] },
                ],
              },
            },
          },
          { $sort: { version: -1, updatedAt: -1 } },
          { $limit: 1 },
        ],
        as: 'studentSubmission',
      },
    },
    {
      $lookup: {
        from: StudentAssignmentState.collection.name,
        let: { assignmentId },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$assignmentId', '$$assignmentId'] },
                  { $eq: ['$studentId', studentObjectId] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: 'studentAssignmentState',
      },
    },
    {
      $lookup: {
        from: 'courses',
        localField: 'courseId',
        foreignField: '_id',
        as: 'course',
      },
    },
    {
      $addFields: {
        dueDate: dueDateExpression,
        studentSubmission: { $first: '$studentSubmission' },
        studentAssignmentState: { $first: '$studentAssignmentState' },
        course: { $first: '$course' },
      },
    },
    {
      $addFields: {
        status: {
          $cond: [
            {
              $or: [
                {
                  $in: [
                    { $ifNull: ['$studentSubmission.status', ''] },
                    completedSubmissionStatuses,
                  ],
                },
                {
                  $and: [
                    { $eq: ['$source', 'personal'] },
                    { $eq: ['$studentAssignmentState.manualCompleted', true] },
                  ],
                },
              ],
            },
            'Completed',
            { $cond: [{ $gt: [now, '$dueDate'] }, 'Overdue', 'Pending'] },
          ],
        },
      },
    },
    {
      $addFields: {
        isDueSoon: {
          $and: [
            { $eq: ['$status', 'Pending'] },
            { $gte: ['$dueDate', now] },
            { $lte: ['$dueDate', new Date(now.getTime() + DAY_SECONDS * 1000)] },
          ],
        },
        dueInSeconds: {
          $cond: [
            { $eq: ['$status', 'Pending'] },
            { $ceil: { $divide: [{ $subtract: ['$dueDate', now] }, 1000] } },
            null,
          ],
        },
      },
    },
  ];
}
