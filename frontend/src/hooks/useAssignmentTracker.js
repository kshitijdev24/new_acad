import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useAssignmentTracker() {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    completedCount: 0,
    overdueCount: 0,
    upcomingCount: 0,
    completionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextAssignments, nextCourses, nextStats] = await Promise.all([
        api.getAssignments(),
        api.getAssignmentCourses(),
        api.getAssignmentStats(),
      ]);
      setAssignments(nextAssignments || []);
      setCourses(nextCourses || []);
      setStats(nextStats || {});
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mutate = useCallback(async (operation) => {
    const result = await operation();
    await refresh();
    return result;
  }, [refresh]);

  return {
    assignments,
    courses,
    stats,
    isLoading,
    error,
    refresh,
    createAssignment: (assignment) => mutate(() => api.createAssignment(assignment)),
    updateAssignment: (assignment) => mutate(() => api.updateAssignment(assignment.id, assignment)),
    deleteAssignment: (id) => mutate(() => api.deleteAssignment(id)),
    setCompletion: (id, completed) => mutate(() => api.setAssignmentCompletion(id, completed)),
    submitAssignment: (id, file, note, onProgress) => mutate(() => api.submitAssignment(id, file, note, onProgress)),
    getSubmissions: (courseId, assignmentId) => api.getAssignmentSubmissions(courseId, assignmentId),
    gradeSubmission: (id, grade) => mutate(() => api.gradeAssignment(id, grade)),
  };
}
