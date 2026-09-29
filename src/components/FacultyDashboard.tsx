import React, { useState } from 'react';
import { Course, Assignment, DoubtQuestion, UserProfile } from '../types/academic';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Plus,
  Edit3,
  Calendar,
  Save,
  MessageSquare
} from 'lucide-react';

interface FacultyDashboardProps {
  currentUser: UserProfile;
  courses: Course[];
  assignments: Assignment[];
  questions: DoubtQuestion[];
  onUpdateCourse: (course: Course) => void;
  onGradeAssignment: (assignmentId: string, marks: number, feedback: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({
  currentUser,
  courses,
  assignments,
  questions,
  onUpdateCourse,
  onGradeAssignment,
  onNavigateTab,
}) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(courses[0]?.code ?? 'CS101');
  const [gradingModalAssignment, setGradingModalAssignment] = useState<Assignment | null>(null);
  const [scoreInput, setScoreInput] = useState<string>('90');
  const [feedbackInput, setFeedbackInput] = useState<string>('Excellent implementation and clarity.');

  const currentCourse = courses.find((c) => c.code === selectedCourseCode) ?? courses[0];

  const pendingGradingAssignments = assignments.filter(
    (a) => a.courseCode === selectedCourseCode && a.status === 'Completed'
  );

  const pendingDoubts = questions.filter(
    (q) => q.courseCode === selectedCourseCode && q.status === 'Pending'
  );

  const handleUpdateAttendance = (delta: number) => {
    if (!currentCourse) return;
    const newAttended = Math.max(0, currentCourse.attendedClasses + delta);
    const newTotal = currentCourse.totalClasses + (delta > 0 ? 1 : 0);
    const newPercent = newTotal > 0 ? (newAttended / newTotal) * 100 : 0;

    onUpdateCourse({
      ...currentCourse,
      attendedClasses: newAttended,
      totalClasses: newTotal,
      attendancePercent: Number(newPercent.toFixed(1)),
    });
  };

  const handleSaveGrading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingModalAssignment) return;

    onGradeAssignment(gradingModalAssignment.id, Number(scoreInput) || 0, feedbackInput.trim());
    setGradingModalAssignment(null);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Faculty Management Panel
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Faculty Coordinator: <span className="font-semibold text-slate-900">{currentUser.name}</span>
            <span className="mx-2 text-slate-300">|</span>
            {currentUser.department}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="assigned-course-select" className="text-xs font-semibold text-slate-700">Assigned Course:</label>
          <select
            id="assigned-course-select"
            value={selectedCourseCode}
            onChange={(e) => setSelectedCourseCode(e.target.value)}
            className="px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 shadow-sm"
          >
            {courses.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Enrolled Students
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
            64
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Section CSE-A (Semester 5)</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Pending Submissions for Grading
          </div>
          <div className="text-3xl font-extrabold text-blue-900 font-mono tabular-nums mt-1">
            {pendingGradingAssignments.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Awaiting faculty assessment</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Unresolved Student Queries
          </div>
          <div className="text-3xl font-extrabold text-amber-800 font-mono tabular-nums mt-1">
            {pendingDoubts.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Requires pedagogical guidance</div>
        </div>
      </div>

      {/* Attendance & Internal Assessment Control */}
      {currentCourse && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Attendance and Continuous Evaluation: {currentCourse.code}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjust session counts and record attendance register data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateAttendance(1)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors"
              >
                + Conduct New Lecture
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <span className="text-xs text-slate-500 block">Class Roster Attendance Average</span>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {currentCourse.attendancePercent.toFixed(1)}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {currentCourse.attendedClasses} of {currentCourse.totalClasses} total lectures held
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <span className="text-xs text-slate-500 block">Class Average Internal Score</span>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {currentCourse.currentScore}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Letter Grade Benchmark: {currentCourse.currentGrade}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded">
              <span className="text-xs text-slate-500 block">Accreditation Threshold</span>
              <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">
                Compliant
              </div>
              <div className="text-xs text-slate-500 mt-1">
                BVCOE minimum attendance requirement (75%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Deliverables Review Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Student Assessment Evaluations
          </h2>
          <span className="text-xs text-slate-500">
            Course deliverables requiring evaluation
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Assignment Title</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Submitted File</th>
                <th className="py-2.5 px-3">Evaluation Status</th>
                <th className="py-2.5 px-3">Grade Awarded</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((asg) => (
                <tr key={asg.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {asg.title}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">Kshitij Jaiswal (09511502722)</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">
                    {asg.submittedFileName ?? 'Pending Submission'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        asg.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {asg.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {asg.obtainedMarks !== undefined
                      ? `${asg.obtainedMarks} / ${asg.maxMarks}`
                      : 'Not Graded'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => {
                        setGradingModalAssignment(asg);
                        setScoreInput(String(asg.obtainedMarks ?? 92));
                        setFeedbackInput(asg.feedback ?? 'Well-structured response.');
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                    >
                      Evaluate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluate Modal */}
      {gradingModalAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-200">
              Evaluate: {gradingModalAssignment.title}
            </h3>

            <form onSubmit={handleSaveGrading} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Marks Awarded (Out of {gradingModalAssignment.maxMarks})
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max={gradingModalAssignment.maxMarks}
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Faculty Feedback and Comments
                </label>
                <textarea
                  rows={3}
                  required
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setGradingModalAssignment(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded"
                >
                  Save Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
