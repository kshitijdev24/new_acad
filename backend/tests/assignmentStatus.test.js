import {
  deriveAssignmentStatus,
  parseAssignmentDueDate,
} from '../services/assignmentStatus.js';

describe('assignment status and due date calculation', () => {
  const now = new Date('2026-11-25T18:00:00.000Z');

  test('computes completed, pending, overdue, and due-soon states', () => {
    expect(deriveAssignmentStatus({
      dueDate: new Date(now.getTime() + 60 * 60 * 1000),
      submission: { status: 'graded' },
      now,
    })).toMatchObject({ status: 'Completed', isDueSoon: false, dueInSeconds: null });

    expect(deriveAssignmentStatus({
      dueDate: new Date(now.getTime() + 60 * 60 * 1000),
      now,
    })).toMatchObject({ status: 'Pending', isDueSoon: true, dueInSeconds: 3600 });

    expect(deriveAssignmentStatus({
      dueDate: new Date(now),
      now,
    })).toMatchObject({ status: 'Pending', isDueSoon: true, dueInSeconds: 0 });

    expect(deriveAssignmentStatus({
      dueDate: new Date(now.getTime() - 1),
      now,
    })).toMatchObject({ status: 'Overdue', isDueSoon: false, dueInSeconds: null });

    expect(deriveAssignmentStatus({
      dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      now,
    })).toMatchObject({ status: 'Pending', isDueSoon: true, dueInSeconds: 86400 });
  });

  test('uses the configured timezone cutoff for date-only input', () => {
    expect(parseAssignmentDueDate('2026-03-01', {
      timeZone: 'Asia/Kolkata',
      endOfDay: '23:59',
    }).toISOString()).toBe('2026-03-01T18:29:59.999Z');
  });

  test('accepts timezone-qualified timestamps and rejects malformed dates', () => {
    expect(parseAssignmentDueDate('2026-11-26T00:00:00+05:30').toISOString())
      .toBe('2026-11-25T18:30:00.000Z');
    expect(() => parseAssignmentDueDate('not-a-date')).toThrow();
    expect(() => parseAssignmentDueDate('2026-02-31')).toThrow();
  });
});
