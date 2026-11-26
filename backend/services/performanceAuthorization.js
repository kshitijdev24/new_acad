import { PerformanceError } from './performanceService.js';

const staffRoles = new Set(['admin', 'faculty', 'advisor']);

export function assertStudentAccess(user, student) {
  if (user.role === 'student') {
    if (String(student.userId) !== String(user.id || user._id)) {
      throw new PerformanceError(403, 'You may only access your own academic records.');
    }
    return;
  }
  if (!staffRoles.has(user.role)) {
    throw new PerformanceError(403, 'You do not have permission to access academic records.');
  }
}
