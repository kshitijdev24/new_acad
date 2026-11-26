import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  AlertTriangle,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import { isAssignmentDueWithin24Hours, formatTimeRemaining, formatDueDateTime } from '../utils/deadline.js';
import { useAssignmentTracker } from '../hooks/useAssignmentTracker.js';

export const AssignmentTracker = ({
  currentUser,
  onAuthenticationRequired,
}) => {
  const {
    assignments,
    courses,
    stats,
    isLoading,
    error,
    refresh,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    setCompletion,
    submitAssignment,
    getSubmissions,
    gradeSubmission,
  } = useAssignmentTracker();
  const [statusFilter, setStatusFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [sortBy, setSortBy] = useState('dueDate');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [courseSubmissions, setCourseSubmissions] = useState([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [gradingValues, setGradingValues] = useState({});

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [detailsAssignment, setDetailsAssignment] = useState(null);
  const [submittingAssignment, setSubmittingAssignment] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // New assignment form state
  const [newTitle, setNewTitle] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [newWeight, setNewWeight] = useState('10');
  const [newDueDate, setNewDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  });
  const [newDescription, setNewDescription] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState('100');

  useEffect(() => {
    if (!newCourseId && courses.length) setNewCourseId(String(courses[0]._id || courses[0].id));
  }, [courses, newCourseId]);

  // Filtered and sorted assignments
  const filteredAssignments = useMemo(() => {
    return (assignments || [])
      .filter((a) => {
        if (statusFilter === 'DueSoon') {
          if (!isAssignmentDueWithin24Hours(a.dueDate, a.status)) return false;
        } else if (statusFilter !== 'All' && a.status !== statusFilter) {
          return false;
        }
        if (courseFilter !== 'All' && a.courseCode !== courseFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'dueDate') {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (sortBy === 'weight') {
          return (b.weightPercent || 0) - (a.weightPercent || 0);
        }
        return 0;
      });
  }, [assignments, statusFilter, courseFilter, sortBy]);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCourseId) return;
    setIsSaving(true);
    setActionError('');
    try {
      await createAssignment({
        title: newTitle.trim(),
        courseId: newCourseId,
        weightPercent: Number(newWeight),
        description: newDescription.trim(),
        dueDate: newDueDate,
        maxMarks: Number(newMaxMarks),
      });
      setNewTitle('');
      setNewDescription('');
      setIsAddModalOpen(false);
    } catch (requestError) {
      if (requestError.status === 401) onAuthenticationRequired?.();
      setActionError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingAssignment) return;
    setIsSaving(true);
    setActionError('');
    try {
      await updateAssignment(editingAssignment);
      setEditingAssignment(null);
    } catch (requestError) {
      if (requestError.status === 401) onAuthenticationRequired?.();
      setActionError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFileConfirm = async (e) => {
    e.preventDefault();
    if (!submittingAssignment || !submissionFile) return;
    setIsSaving(true);
    setActionError('');
    try {
    setUploadProgress(0);
    await submitAssignment(
      submittingAssignment.id,
      submissionFile,
      submissionNote,
      setUploadProgress
    );
      setSubmittingAssignment(null);
      setSubmissionFile(null);
      setSubmissionNote('');
    setUploadProgress(0);
    } catch (requestError) {
      if (requestError.status === 401) onAuthenticationRequired?.();
      setActionError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openAssignmentDetails = async (assignment) => {
    setDetailsAssignment(assignment);
    setCourseSubmissions([]);
    if (currentUser?.role !== 'faculty') return;
    setIsLoadingSubmissions(true);
    try {
      const result = await getSubmissions(assignment.courseId, assignment.id);
      setCourseSubmissions(result.items || []);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleGradeSubmission = async (submission) => {
    const value = gradingValues[submission.submissionId];
    if (!value || !submission.submissionId) return;
    setActionError('');
    try {
      await gradeSubmission(submission.submissionId, {
        obtainedMarks: Number(value.obtainedMarks),
        feedback: value.feedback || '',
      });
      const result = await getSubmissions(detailsAssignment.courseId, detailsAssignment.id);
      setCourseSubmissions(result.items || []);
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!window.confirm(`Delete "${assignment.title}"?`)) return;
    setActionError('');
    try {
      await deleteAssignment(assignment.id);
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Assignment Tracker
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage course deliverables, track evaluation weights, and monitor submission timelines.
          </p>
        </div>

        {['student', 'faculty'].includes(currentUser?.role) && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Assignment
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          <span>{error.message}</span>
          <button onClick={refresh} className="font-semibold underline">Retry</button>
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {actionError}
        </div>
      )}

      {/* Filter Row */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">My Assignments</h2>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                aria-label="Filter assignments by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-700"
              >
                <option value="All">All</option>
                <option value="DueSoon">Due Soon (&lt;24h)</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

            {/* Course Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Course:</span>
              <select
                aria-label="Filter assignments by course"
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-700"
              >
                <option value="All">All Courses</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Sort By:</span>
              <select
                aria-label="Sort assignments"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-700"
              >
                <option value="dueDate">Due Date</option>
                <option value="weight">Weight %</option>
              </select>
            </div>
          </div>
        </div>

        {/* Assignment Cards List */}
        <div className="mt-4 divide-y divide-slate-100">
          {isLoading ? (
            <div className="space-y-3 py-5" aria-label="Loading assignments">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              {assignments.length === 0
                ? 'No assignments yet. Create an assignment to get started.'
                : 'No assignments match the selected filter parameters.'}
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 px-2 rounded transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    {assignment.source === 'personal' ? (
                      <input
                        type="checkbox"
                        checked={assignment.status === 'Completed'}
                        aria-label={`Mark ${assignment.title} completed`}
                        onChange={async () => {
                          try {
                            await setCompletion(assignment.id, assignment.status !== 'Completed');
                          } catch (requestError) {
                            setActionError(requestError.message);
                          }
                        }}
                        className="rounded border-slate-300 text-blue-700 focus:ring-blue-600 h-4 w-4 cursor-pointer"
                      />
                    ) : (
                      <span className="w-4" aria-hidden="true" />
                    )}
                    <h3 className="text-sm font-bold text-slate-900">
                      {assignment.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                      {assignment.courseCode}
                    </span>
                    <span className="text-slate-500">
                      Weight: <strong className="text-slate-700 font-mono">{assignment.weightPercent}%</strong>
                    </span>
                    {assignment.obtainedMarks !== undefined && (
                      <span className="text-emerald-700 font-semibold font-mono">
                        Score: {assignment.obtainedMarks}/{assignment.maxMarks}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    {assignment.description}
                  </p>
                </div>

                {/* Right metadata and buttons */}
                <div className="flex flex-col sm:items-end justify-between gap-2 shrink-0">
                  <div className="text-left sm:text-right space-y-1">
                    <div className="flex flex-wrap items-center sm:justify-end gap-1.5">
                      {isAssignmentDueWithin24Hours(assignment.dueDate, assignment.status) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Due in {formatTimeRemaining(assignment.dueDate)}</span>
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold ${
                          assignment.status === 'Completed'
                            ? 'text-emerald-700'
                            : assignment.status === 'Overdue'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      Due: {formatDueDateTime(assignment.dueDate)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {assignment.canSubmit && (
                      <button
                        onClick={() => {
                          setSubmittingAssignment(assignment);
                          setSubmissionFile(null);
                          setSubmissionNote('');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded border border-blue-700 transition-colors"
                      >
                        Submit
                      </button>
                    )}
                    {assignment.canEdit && (
                      <>
                        <button
                          onClick={() => setEditingAssignment(assignment)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAssignment(assignment)}
                          className="px-2.5 py-1 text-xs font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openAssignmentDetails(assignment)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assignment Statistics */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-slate-900 mb-4">Assignment Statistics</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Completion Rate
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
              {stats.completionRate || 0}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats.completedCount || 0} of {stats.totalCount || 0} assignments completed
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Upcoming Due
            </div>
            <div className="text-3xl font-extrabold text-blue-900 font-mono tabular-nums mt-1">
              {(stats.upcomingCount || 0) === 0 ? 'None' : stats.upcomingCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Within current academic cycle
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Overdue
            </div>
            <div className={`text-3xl font-extrabold font-mono tabular-nums mt-1 ${(stats.overdueCount || 0) > 0 ? 'text-red-700' : 'text-slate-900'}`}>
              {stats.overdueCount || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Requires immediate faculty submission
            </div>
          </div>
        </div>
      </div>

        {/* Add Assignment Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Add New Assignment</h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
              {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{actionError}</p>}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dynamic Programming Problem Set"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Course Code
                  </label>
                  <select
                    required
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 font-mono"
                  >
                    <option value="" disabled>Select a course</option>
                    {courses.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Evaluation Weight (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Maximum Marks
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={newMaxMarks}
                    onChange={(e) => setNewMaxMarks(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description and Deliverable Guidelines
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline expected code files, derivations, or report format..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !courses.length}
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded disabled:opacity-50"
                >
                  {isSaving ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Edit Assignment</h3>
              <button
                onClick={() => setEditingAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{actionError}</p>}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingAssignment.title}
                  onChange={(e) =>
                    setEditingAssignment({ ...editingAssignment, title: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editingAssignment.dueDate?.slice(0, 10) || ''}
                    onChange={(e) =>
                      setEditingAssignment({ ...editingAssignment, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Evaluation Weight (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingAssignment.weightPercent}
                    onChange={(e) => setEditingAssignment({ ...editingAssignment, weightPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Maximum Marks
                </label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={editingAssignment.maxMarks}
                  onChange={(e) => setEditingAssignment({ ...editingAssignment, maxMarks: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingAssignment.description}
                  onChange={(e) =>
                    setEditingAssignment({ ...editingAssignment, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{detailsAssignment.title}</h3>
                <span className="text-xs font-mono text-blue-900 font-semibold">
                  Course: {detailsAssignment.courseCode}
                </span>
              </div>
              <button
                onClick={() => setDetailsAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{actionError}</p>}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="font-semibold text-slate-900 mb-1">Instructions:</div>
                <p className="leading-relaxed">{detailsAssignment.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500">Weight: </span>
                  <span className="font-bold text-slate-900 font-mono">{detailsAssignment.weightPercent}%</span>
                </div>
                <div>
                  <span className="text-slate-500">Maximum Marks: </span>
                  <span className="font-bold text-slate-900 font-mono">{detailsAssignment.maxMarks}</span>
                </div>
                <div>
                  <span className="text-slate-500">Submission Due: </span>
                  <span className="font-bold text-slate-900 font-mono">{formatDueDateTime(detailsAssignment.dueDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Current Status: </span>
                  <span className="font-bold text-blue-900">{detailsAssignment.status}</span>
                </div>
              </div>

              {detailsAssignment.submission?.fileName && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-800" />
                  <div>
                    <div className="font-semibold text-blue-950">Submitted Artifact:</div>
                    <a
                      className="font-mono text-blue-700 underline"
                      href={detailsAssignment.submission.downloadUrl}
                    >
                      {detailsAssignment.submission.fileName}
                    </a>
                  </div>
                </div>
              )}

              {detailsAssignment.feedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                  <div className="font-semibold text-emerald-950 mb-1">Faculty Feedback:</div>
                  <p className="text-emerald-900">{detailsAssignment.feedback}</p>
                  {detailsAssignment.obtainedMarks !== undefined && (
                    <div className="mt-1 font-bold text-emerald-950 font-mono">
                      Graded Score: {detailsAssignment.obtainedMarks} / {detailsAssignment.maxMarks}
                    </div>
                  )}

                  {currentUser?.role === 'faculty' && (
                    <div className="space-y-3 border-t border-slate-200 pt-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">Student Submissions</h4>
                        {isLoadingSubmissions && <span className="text-slate-500">Loading...</span>}
                      </div>
                      {!isLoadingSubmissions && courseSubmissions.length === 0 && (
                        <p className="text-slate-500">No enrolled student submissions found.</p>
                      )}
                      {courseSubmissions.map((submission) => (
                        <div key={submission.studentId} className="rounded border border-slate-200 p-3 space-y-2">
                          <div className="flex justify-between gap-3">
                            <span className="font-semibold text-slate-900">{submission.name || submission.enrollmentNumber}</span>
                            <span className="text-slate-600 capitalize">{submission.status}</span>
                          </div>
                          {submission.files?.map((file) => (
                            <a key={file.downloadUrl} href={file.downloadUrl} className="block text-blue-700 underline">
                              {file.originalName}
                            </a>
                          ))}
                          {submission.status !== 'pending' && submission.status !== 'graded' && (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <input
                                type="number"
                                min="0"
                                max={detailsAssignment.maxMarks}
                                aria-label={`Marks for ${submission.name}`}
                                placeholder={`Out of ${detailsAssignment.maxMarks}`}
                                value={gradingValues[submission.submissionId]?.obtainedMarks || ''}
                                onChange={(event) => setGradingValues((current) => ({
                                  ...current,
                                  [submission.submissionId]: {
                                    ...current[submission.submissionId],
                                    obtainedMarks: event.target.value,
                                  },
                                }))}
                                className="rounded border border-slate-300 px-2 py-1"
                              />
                              <input
                                type="text"
                                aria-label={`Feedback for ${submission.name}`}
                                placeholder="Feedback"
                                value={gradingValues[submission.submissionId]?.feedback || ''}
                                onChange={(event) => setGradingValues((current) => ({
                                  ...current,
                                  [submission.submissionId]: {
                                    ...current[submission.submissionId],
                                    feedback: event.target.value,
                                  },
                                }))}
                                className="rounded border border-slate-300 px-2 py-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleGradeSubmission(submission)}
                                className="rounded bg-blue-700 px-3 py-1 font-semibold text-white"
                              >
                                Grade
                              </button>
                            </div>
                          )}
                          {submission.status === 'graded' && (
                            <p className="text-emerald-700">Grade: {submission.obtainedMarks} / {detailsAssignment.maxMarks}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDetailsAssignment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Modal */}
      {submittingAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Submit Deliverable
              </h3>
              <button
                onClick={() => setSubmittingAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitFileConfirm} className="space-y-4 text-xs">
              {actionError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-red-800">{actionError}</p>}
              <div>
                <span className="font-semibold text-slate-700">Assignment: </span>
                <span className="text-slate-900 font-bold">{submittingAssignment.title}</span>
                <span className="text-slate-500 font-mono ml-2">({submittingAssignment.courseCode})</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload Document / Code File
                </label>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(false);
                    setSubmissionFile(event.dataTransfer.files?.[0] || null);
                  }}
                  className={`border-2 border-dashed p-4 rounded text-center transition-colors ${isDraggingFile ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'}`}
                >
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600 font-medium">Drop a file here or choose one</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, ZIP, JAVA, PY, DOCX</p>
                  <input
                    type="file"
                    required
                    accept=".pdf,.zip,.java,.py,.docx"
                    onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-left text-xs"
                  />
                  {submissionFile && (
                    <p className="mt-2 truncate font-mono text-slate-700">{submissionFile.name}</p>
                  )}
                  {isSaving && (
                    <div className="mt-3" aria-live="polite">
                      <div className="h-2 overflow-hidden rounded bg-slate-200">
                        <div className="h-full bg-blue-700 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="mt-1 text-slate-600">{uploadProgress}% uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Submission Note
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSubmittingAssignment(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !submissionFile}
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded disabled:opacity-50"
                >
                  {isSaving ? 'Uploading...' : 'Submit for Grading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
