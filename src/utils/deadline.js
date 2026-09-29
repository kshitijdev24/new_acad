/**
 * Returns the exact timestamp (ms) for an assignment's due date string.
 * Supports ISO strings (YYYY-MM-DDTHH:mm), date-only strings (YYYY-MM-DD defaulting to 23:59:59),
 * and standard date formats.
 */
export function getAssignmentDueTimestamp(dueDateStr) {
  if (!dueDateStr) return 0;
  if (dueDateStr.includes('T')) {
    const timestamp = new Date(dueDateStr).getTime();
    if (!isNaN(timestamp)) return timestamp;
  }

  const parts = dueDateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 23, 59, 59, 999).getTime();
    }
  }

  const parsed = new Date(dueDateStr).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Checks if an assignment deadline is within 24 hours from current time.
 */
export function isAssignmentDueWithin24Hours(
  dueDateStr,
  status,
  now = Date.now()
) {
  if (status && status !== 'Pending') return false;
  const dueTimestamp = getAssignmentDueTimestamp(dueDateStr);
  if (!dueTimestamp) return false;

  const diffMs = dueTimestamp - now;
  // Due in the future and within 24 hours (86,400,000 ms)
  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
}

/**
 * Filters and returns all pending assignments whose deadlines are within 24 hours,
 * sorted by earliest deadline first.
 */
export function getDueSoonAssignments(
  assignments = [],
  now = Date.now()
) {
  return assignments
    .filter((a) => isAssignmentDueWithin24Hours(a.dueDate, a.status, now))
    .sort((a, b) => getAssignmentDueTimestamp(a.dueDate) - getAssignmentDueTimestamp(b.dueDate));
}

/**
 * Formats the countdown time remaining into a concise, human-readable string.
 */
export function formatTimeRemaining(
  dueDateStr,
  now = Date.now()
) {
  const dueTimestamp = getAssignmentDueTimestamp(dueDateStr);
  if (!dueTimestamp) return 'Invalid deadline';

  const diffMs = dueTimestamp - now;
  if (diffMs <= 0) {
    return 'Deadline reached';
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m remaining`;
  }
  if (minutes === 0) {
    return `${hours}h remaining`;
  }
  return `${hours}h ${minutes}m left`;
}

/**
 * Formats due date & time in a professional academic style.
 */
export function formatDueDateTime(dueDateStr) {
  const dueTimestamp = getAssignmentDueTimestamp(dueDateStr);
  if (!dueTimestamp) return dueDateStr;

  const date = new Date(dueTimestamp);
  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };

  if (dueDateStr.includes('T')) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }

  return date.toLocaleDateString('en-US', options);
}
