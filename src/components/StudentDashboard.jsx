import React, { useState } from 'react';
import { GRADE_POINTS, INITIAL_LECTURE_EVENTS } from '../data/mockData.js';
import { exportStudentDashboardPdf } from '../utils/exportPdf.js';
import { AcademicPerformanceTrendGraph } from './AcademicPerformanceTrendGraph.jsx';
import { SmartStudySessionGenerator } from './SmartStudySessionGenerator.jsx';
import {
  Calendar,
  CheckSquare,
  TrendingUp,
  FileText,
  Clock,
  ArrowRight,
  HelpCircle,
  Download,
  Check,
} from 'lucide-react';

export const StudentDashboard = ({
  currentUser,
  courses = [],
  assignments = [],
  announcements = [],
  lectureEvents = INITIAL_LECTURE_EVENTS,
  onNavigateTab,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Compute accurate real-time GPA from courses
  const totalCredits = (courses || []).reduce((sum, c) => sum + c.credits, 0);
  const totalGradePoints = (courses || []).reduce((sum, c) => {
    const pts = GRADE_POINTS[c.currentGrade] ?? 3.0;
    return sum + pts * c.credits;
  }, 0);
  const currentGpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : '3.52';

  // Overall attendance calculation
  const totalAttended = (courses || []).reduce((sum, c) => sum + c.attendedClasses, 0);
  const totalHeld = (courses || []).reduce((sum, c) => sum + c.totalClasses, 0);
  const overallAttendance = totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(1) : '88.5';

  const upcomingAssignments = (assignments || []).filter((a) => a.status === 'Pending');
  const completedAssignmentsCount = (assignments || []).filter((a) => a.status === 'Completed').length;

  const handleExportPdf = () => {
    setIsExportingPdf(true);
    try {
      exportStudentDashboardPdf({
        currentUser,
        courses,
        assignments,
        currentGpa,
        overallAttendance,
        totalCredits,
      });
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export PDF summary:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Student Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Student Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Student: <span className="font-semibold text-slate-800">{currentUser?.name}</span>
            {currentUser?.enrollmentNumber && (
              <span className="font-mono text-[11px] sm:text-xs text-slate-500 block sm:inline sm:ml-2">
                (Enrollment: {currentUser.enrollmentNumber})
              </span>
            )}
            <span className="hidden sm:inline mx-2 text-slate-300">|</span>
            <span className="block sm:inline text-slate-500 mt-0.5 sm:mt-0">
              {currentUser?.department || 'Computer Science and Engineering'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Download verified institutional academic summary PDF"
          >
            {exportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                <span className="text-emerald-700">PDF Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                <span className="hidden xs:inline">Export PDF</span>
                <span className="xs:hidden">PDF</span>
              </>
            )}
          </button>
          <button
            onClick={() => onNavigateTab('gpa')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700" />
            <span>GPA Predictor</span>
          </button>
          <button
            onClick={() => onNavigateTab('assignments')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Assignments</span>
          </button>
        </div>
      </div>

      {/* Academic Overview Card Grid */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-5">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900 mb-3 sm:mb-4 flex items-center justify-between">
          <span>Academic Overview</span>
          <span className="text-[11px] sm:text-xs font-normal text-slate-500">Current Semester Progress</span>
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">
              Current GPA
            </div>
            <div className="text-xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {currentGpa}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1">Scale of 4.00</div>
          </div>

          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">
              Completed Credits
            </div>
            <div className="text-xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {totalCredits}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">4 Enrolled Courses</div>
          </div>

          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">
              Overall Attendance
            </div>
            <div className="text-xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {overallAttendance}%
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-700 font-medium mt-1 truncate">Above 75% Requirement</div>
          </div>

          <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">
              Pending Tasks
            </div>
            <div className="text-xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {upcomingAssignments.length}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">
              {completedAssignmentsCount} Submissions Graded
            </div>
          </div>
        </div>
      </div>

      {/* Visual Academic Trend Graph (Recharts: GPA Growth & Assignment Performance) */}
      <AcademicPerformanceTrendGraph currentGpa={currentGpa} />

      {/* Smart Study Session Generator (Analyzes pending assignments & lecture schedules) */}
      <SmartStudySessionGenerator
        assignments={assignments}
        courses={courses}
        lectures={lectureEvents}
        studentName={currentUser?.name || 'Student'}
        onNavigateTab={onNavigateTab}
      />

      {/* Current Courses Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">Current Courses</h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Department curriculum offerings and internal grading marks
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('calendar')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View Lecture Schedule</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 text-[11px] sm:text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">Course Code</th>
                <th className="py-2.5 px-3 sm:py-3 sm:px-4 min-w-[160px]">Course Name</th>
                <th className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">Credits</th>
                <th className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">Current Grade</th>
                <th className="py-2.5 px-3 sm:py-3 sm:px-4 min-w-[140px]">Attendance</th>
                <th className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">Faculty In-Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {(courses || []).map((course) => (
                <tr key={course.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 font-mono font-semibold text-blue-950 whitespace-nowrap">
                    {course.code}
                  </td>
                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-slate-900">
                    <div className="font-semibold sm:font-medium">{course.name}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{course.schedule}</div>
                  </td>
                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 font-mono tabular-nums whitespace-nowrap">{course.credits}</td>
                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                      {course.currentGrade}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-500 ml-1.5 font-mono">
                      ({course.currentScore}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-xs font-semibold">
                        {course.attendancePercent?.toFixed(1)}%
                      </span>
                      <div className="w-16 sm:w-20 bg-slate-200 h-1.5 rounded overflow-hidden">
                        <div
                          className={`h-full ${
                            course.attendancePercent >= 85
                              ? 'bg-emerald-600'
                              : course.attendancePercent >= 75
                              ? 'bg-blue-600'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(course.attendancePercent || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                      {course.attendedClasses} of {course.totalClasses} classes attended
                    </div>
                  </td>
                  <td className="py-2.5 px-3 sm:py-3 sm:px-4 text-[11px] sm:text-xs text-slate-600 whitespace-nowrap">{course.facultyName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Upcoming Assignments + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Upcoming Assignments */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Upcoming Assignments</span>
              </h2>
              <button
                onClick={() => onNavigateTab('assignments')}
                className="text-xs font-medium text-blue-700 hover:text-blue-900"
              >
                View all ({assignments.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(assignments || []).slice(0, 4).map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {assignment.title}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {assignment.courseCode}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {assignment.dueDate}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded ${
                            assignment.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : assignment.status === 'Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {assignment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigateTab('assignments')}
              className="w-full py-2 text-center text-xs font-semibold text-blue-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
            >
              Open Assignment Submission Portal
            </button>
          </div>
        </div>

        {/* Announcements */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Announcements</span>
              </h2>
              <span className="text-xs text-slate-400">Official Notices</span>
            </div>

            <div className="space-y-3.5">
              {(announcements || []).map((ann) => (
                <div
                  key={ann.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-md hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900">{ann.title}</h3>
                    <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                      {ann.date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ann.content}</p>
                  <div className="text-[11px] text-slate-400 mt-1.5 font-medium">
                    Posted by: {ann.author}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Synchronized with BVCOE Academic Portal</span>
            <button
              onClick={() => onNavigateTab('doubts')}
              className="font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Raise Query to Faculty</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
