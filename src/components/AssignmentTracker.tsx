import React, { useState, useMemo } from 'react';
import { Assignment, Course, AssignmentStatus } from '../types/academic';
import {
  Plus,
  Filter,
  CheckSquare,
  Clock,
  AlertTriangle,
  Upload,
  FileCheck,
  Edit2,
  Info,
  X,
  FileText
} from 'lucide-react';
import { isAssignmentDueWithin24Hours, formatTimeRemaining, formatDueDateTime } from '../utils/deadline';

interface AssignmentTrackerProps {
  assignments: Assignment[];
  courses: Course[];
  onAddAssignment: (assignment: Omit<Assignment, 'id'>) => void;
  onUpdateAssignment: (assignment: Assignment) => void;
  onSubmitWork: (assignmentId: string, fileName: string) => void;
}

export const AssignmentTracker: React.FC<AssignmentTrackerProps> = ({
  assignments,
  courses,
  onAddAssignment,
  onUpdateAssignment,
  onSubmitWork,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [courseFilter, setCourseFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('dueDate');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [detailsAssignment, setDetailsAssignment] = useState<Assignment | null>(null);
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [submissionFileName, setSubmissionFileName] = useState<string>('');

  // New assignment form state
  const [newTitle, setNewTitle] = useState('');
  const [newCourseCode, setNewCourseCode] = useState(courses[0]?.code ?? 'CS101');
  const [newWeight, setNewWeight] = useState('10');
  const [newDueDate, setNewDueDate] = useState('2026-10-25');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState('100');

  // Filtered and sorted assignments
  const filteredAssignments = useMemo(() => {
    return assignments
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
          return b.weightPercent - a.weightPercent;
        }
        return 0;
      });
  }, [assignments, statusFilter, courseFilter, sortBy]);

  // Statistics
  const totalCount = assignments.length;
  const completedCount = assignments.filter((a) => a.status === 'Completed').length;
  const overdueCount = assignments.filter((a) => a.status === 'Overdue').length;
  const upcomingCount = assignments.filter((a) => a.status === 'Pending').length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddAssignment({
      title: newTitle.trim(),
      courseCode: newCourseCode,
      weightPercent: Number(newWeight) || 10,
      description: newDescription.trim() || 'Complete the assignment according to course syllabus.',
      dueDate: newDueDate,
      status: 'Pending',
      maxMarks: Number(newMaxMarks) || 100,
    });

    setNewTitle('');
    setNewDescription('');
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment) return;
    onUpdateAssignment(editingAssignment);
    setEditingAssignment(null);
  };

  const handleSubmitFileConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment || !submissionFileName.trim()) return;
    onSubmitWork(submittingAssignment.id, submissionFileName.trim());
    setSubmittingAssignment(null);
    setSubmissionFileName('');
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

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Assignment
        </button>
      </div>

      {/* Filter Row matching Fig 1.3 */}
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

        {/* Assignment Cards List matching Fig 1.3 */}
        <div className="mt-4 divide-y divide-slate-100">
          {filteredAssignments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No assignments match the selected filter parameters.
            </div>
          ) : (
            filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 px-2 rounded transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={assignment.status === 'Completed'}
                      onChange={() => {
                        const newStatus: AssignmentStatus =
                          assignment.status === 'Completed' ? 'Pending' : 'Completed';
                        onUpdateAssignment({
                          ...assignment,
                          status: newStatus,
                          submissionDate: newStatus === 'Completed' ? '2026-10-09' : undefined,
                        });
                      }}
                      className="rounded border-slate-300 text-blue-700 focus:ring-blue-600 h-4 w-4 cursor-pointer"
                    />
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

                {/* Right metadata and buttons matching Fig 1.3 */}
                <div className="flex flex-col sm:items-end justify-between gap-2 shrink-0">
                  <div className="text-right space-y-1">
                    <div className="flex items-center sm:justify-end gap-1.5">
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

                  <div className="flex items-center gap-2">
                    {assignment.status !== 'Completed' && (
                      <button
                        onClick={() => {
                          setSubmittingAssignment(assignment);
                          setSubmissionFileName(`${assignment.courseCode.toLowerCase()}_solution.pdf`);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded border border-blue-700 transition-colors"
                      >
                        Submit
                      </button>
                    )}
                    <button
                      onClick={() => setEditingAssignment(assignment)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDetailsAssignment(assignment)}
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

      {/* Assignment Statistics (Bottom card of Fig 1.3 match) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-slate-900 mb-4">Assignment Statistics</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Completion Rate
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
              {completionRate}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {completedCount} of {totalCount} assignments completed
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Upcoming Due
            </div>
            <div className="text-3xl font-extrabold text-blue-900 font-mono tabular-nums mt-1">
              {upcomingCount === 0 ? 'None' : upcomingCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Within current academic cycle
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Overdue
            </div>
            <div className={`text-3xl font-extrabold font-mono tabular-nums mt-1 ${overdueCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
              {overdueCount}
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
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add New Assignment</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
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
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-700 font-mono"
                  >
                    {courses.map((c) => (
                      <option key={c.code} value={c.code}>
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
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Edit Assignment</h3>
              <button
                onClick={() => setEditingAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
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
                    Status
                  </label>
                  <select
                    value={editingAssignment.status}
                    onChange={(e) =>
                      setEditingAssignment({
                        ...editingAssignment,
                        status: e.target.value as AssignmentStatus,
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editingAssignment.dueDate}
                    onChange={(e) =>
                      setEditingAssignment({ ...editingAssignment, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                  />
                </div>
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
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{detailsAssignment.title}</h3>
                <span className="text-xs font-mono text-blue-900 font-semibold">
                  Course: {detailsAssignment.courseCode}
                </span>
              </div>
              <button
                onClick={() => setDetailsAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
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
                  <span className="font-bold text-slate-900 font-mono">{detailsAssignment.dueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500">Current Status: </span>
                  <span className="font-bold text-blue-900">{detailsAssignment.status}</span>
                </div>
              </div>

              {detailsAssignment.submittedFileName && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-800" />
                  <div>
                    <div className="font-semibold text-blue-950">Submitted Artifact:</div>
                    <div className="font-mono text-slate-600">{detailsAssignment.submittedFileName}</div>
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
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Submit Deliverable
              </h3>
              <button
                onClick={() => setSubmittingAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitFileConfirm} className="space-y-4 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Assignment: </span>
                <span className="text-slate-900 font-bold">{submittingAssignment.title}</span>
                <span className="text-slate-500 font-mono ml-2">({submittingAssignment.courseCode})</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload Document / Code File
                </label>
                <div className="border-2 border-dashed border-slate-300 p-4 rounded text-center hover:bg-slate-50 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600 font-medium">Select file or enter filename below</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, ZIP, JAVA, PY, DOCX</p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Artifact Filename
                </label>
                <input
                  type="text"
                  required
                  value={submissionFileName}
                  onChange={(e) => setSubmissionFileName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono"
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
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded"
                >
                  Confirm Submission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
