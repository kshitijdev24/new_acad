import React, { useState, useMemo } from 'react';
import { LectureEvent, LectureEventType } from '../types/academic';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Download,
  Plus,
  X,
  Filter
} from 'lucide-react';

interface LectureCalendarProps {
  events: LectureEvent[];
  userRole?: string;
  onAddEvent?: (event: Omit<LectureEvent, 'id'>) => void;
}

export const LectureCalendar: React.FC<LectureCalendarProps> = ({
  events,
  userRole,
  onAddEvent,
}) => {
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [selectedEventType, setSelectedEventType] = useState<string>('All');
  const [selectedEventDetails, setSelectedEventDetails] = useState<LectureEvent | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  // Form state for scheduling new lecture
  const [newCourseCode, setNewCourseCode] = useState('CS101');
  const [newCourseName, setNewCourseName] = useState('Introduction to Computer Science');
  const [newType, setNewType] = useState<LectureEventType>('Lecture');
  const [newDate, setNewDate] = useState('2026-10-15');
  const [newStartTime, setNewStartTime] = useState('10:00 AM');
  const [newEndTime, setNewEndTime] = useState('11:30 AM');
  const [newLocation, setNewLocation] = useState('Hall A-101');
  const [newUnitTopic, setNewUnitTopic] = useState('');
  const [newFaculty, setNewFaculty] = useState('Ms. Deepika Yadav');

  // Days array for the active academic week view (Fig 1.6 match)
  const daysOfWeek = [
    { name: 'Sunday', short: 'Sun', dayIndex: 0, dateStr: '2026-10-11', dayNum: 11 },
    { name: 'Monday', short: 'Mon', dayIndex: 1, dateStr: '2026-10-12', dayNum: 12 },
    { name: 'Tuesday', short: 'Tue', dayIndex: 2, dateStr: '2026-10-13', dayNum: 13 },
    { name: 'Wednesday', short: 'Wed', dayIndex: 3, dateStr: '2026-10-14', dayNum: 14 },
    { name: 'Thursday', short: 'Thu', dayIndex: 4, dateStr: '2026-10-15', dayNum: 15 },
    { name: 'Friday', short: 'Fri', dayIndex: 5, dateStr: '2026-10-16', dayNum: 16 },
    { name: 'Saturday', short: 'Sat', dayIndex: 6, dateStr: '2026-10-17', dayNum: 17 },
  ];

  const filteredEvents = useMemo(() => {
    if (selectedEventType === 'All') return events;
    return events.filter((e) => e.type === selectedEventType);
  }, [events, selectedEventType]);

  const getEventsForDay = (dayIndex: number) => {
    return filteredEvents.filter((e) => e.dayOfWeek === dayIndex);
  };

  const getTypeColor = (type: LectureEventType) => {
    switch (type) {
      case 'Lecture':
        return {
          border: 'border-l-blue-600',
          badge: 'bg-blue-100 text-blue-800',
          dot: 'bg-blue-600',
        };
      case 'Lab':
        return {
          border: 'border-l-emerald-600',
          badge: 'bg-emerald-100 text-emerald-800',
          dot: 'bg-emerald-600',
        };
      case 'Discussion':
        return {
          border: 'border-l-indigo-600',
          badge: 'bg-indigo-100 text-indigo-800',
          dot: 'bg-indigo-600',
        };
      case 'Exam':
        return {
          border: 'border-l-red-600',
          badge: 'bg-red-100 text-red-800',
          dot: 'bg-red-600',
        };
      case 'Tutorial':
        return {
          border: 'border-l-amber-600',
          badge: 'bg-amber-100 text-amber-800',
          dot: 'bg-amber-600',
        };
    }
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddEvent) return;

    const parsedDate = new Date(newDate);
    const day = isNaN(parsedDate.getDay()) ? 1 : parsedDate.getDay();

    onAddEvent({
      courseCode: newCourseCode,
      courseName: newCourseName,
      type: newType,
      date: newDate,
      dayOfWeek: day,
      startTime: newStartTime,
      endTime: newEndTime,
      location: newLocation,
      unitTopic: newUnitTopic.trim() || 'Unit Lecture and Problem Solving',
      facultyName: newFaculty,
      notesAvailable: true,
      notesTitle: `${newCourseCode}_LectureNotes_${newDate}.pdf`,
    });

    setIsScheduleModalOpen(false);
    setNewUnitTopic('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Lecture Calendar
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Unit-wise timetable, lecture hall assignments, lab sessions, and test schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Lecture / Event
          </button>
        </div>
      </div>

      {/* Main Calendar Container matching Fig 1.6 */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        {/* Navigation & Month Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <button
            onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="text-center">
            <h2 className="text-base font-bold text-slate-900">October 2026</h2>
            <div className="text-xs text-slate-500 font-mono">Academic Week 6</div>
          </div>

          <button
            onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Days Header Row (Fig 1.6 match) */}
        <div className="grid grid-cols-7 border-b border-slate-200 text-center py-3 bg-slate-50 text-xs font-semibold text-slate-600">
          {daysOfWeek.map((day) => (
            <div key={day.short}>
              <div className="text-slate-500">{day.short}</div>
              <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">{day.dayNum}</div>
            </div>
          ))}
        </div>

        {/* Week Day by Day Schedule Rows matching Fig 1.6 */}
        <div className="divide-y divide-slate-100">
          {daysOfWeek.map((day) => {
            const dayEvents = getEventsForDay(day.dayIndex);

            return (
              <div key={day.name} className="py-4 px-2">
                <div className="text-xs font-bold text-slate-800 mb-2">
                  {day.name}, October {day.dayNum}
                </div>

                {dayEvents.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2 pl-3">
                    No events scheduled
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayEvents.map((event) => {
                      const color = getTypeColor(event.type);

                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEventDetails(event)}
                          className={`p-3 bg-slate-50 hover:bg-slate-100 border-l-4 ${color.border} border border-slate-200 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 font-mono">
                                {event.courseCode} {event.type}
                              </span>
                              <span className="text-xs text-slate-600 hidden sm:inline">
                                ({event.courseName})
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {event.startTime} - {event.endTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                Location: {event.location}
                              </span>
                              <span className="text-slate-600 hidden md:inline">
                                Instructor: {event.facultyName}
                              </span>
                            </div>

                            <div className="text-xs text-slate-700 font-medium">
                              {event.unitTopic}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {event.notesAvailable && (
                              <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-medium">
                                <FileText className="w-3 h-3" />
                                Notes
                              </span>
                            )}
                            <span
                              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded ${color.badge}`}
                            >
                              {event.type}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Event Types Legend matching Fig 1.6 */}
        <div className="pt-5 mt-4 border-t border-slate-200">
          <div className="text-xs font-bold text-slate-900 mb-2">Event Types</div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
            <button
              onClick={() => setSelectedEventType('All')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedEventType === 'All' ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSelectedEventType('Lecture')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                selectedEventType === 'Lecture' ? 'bg-blue-100 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-600" />
              <span>Lecture</span>
            </button>
            <button
              onClick={() => setSelectedEventType('Lab')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                selectedEventType === 'Lab' ? 'bg-emerald-100 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
              <span>Lab</span>
            </button>
            <button
              onClick={() => setSelectedEventType('Discussion')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                selectedEventType === 'Discussion' ? 'bg-indigo-100 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
              <span>Discussion</span>
            </button>
            <button
              onClick={() => setSelectedEventType('Exam')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                selectedEventType === 'Exam' ? 'bg-red-100 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-red-600" />
              <span>Exam</span>
            </button>
            <button
              onClick={() => setSelectedEventType('Tutorial')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                selectedEventType === 'Tutorial' ? 'bg-amber-100 font-bold' : 'hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
              <span>Tutorial</span>
            </button>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEventDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedEventDetails.courseCode} {selectedEventDetails.type}
                </h3>
                <span className="text-xs text-slate-500 font-normal">
                  {selectedEventDetails.courseName}
                </span>
              </div>
              <button
                onClick={() => setSelectedEventDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded">
                <div>
                  <span className="text-slate-500">Date:</span>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    {selectedEventDetails.date}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Time:</span>
                  <div className="font-bold text-slate-900 font-mono mt-0.5">
                    {selectedEventDetails.startTime} - {selectedEventDetails.endTime}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Venue:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {selectedEventDetails.location}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Faculty:</span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {selectedEventDetails.facultyName}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-900 mb-1">Unit Syllabus Topic:</div>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-800 leading-relaxed font-medium">
                  {selectedEventDetails.unitTopic}
                </p>
              </div>

              {selectedEventDetails.notesAvailable && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-800" />
                    <div>
                      <div className="font-semibold text-blue-950">Curriculum Handout Available</div>
                      <div className="font-mono text-slate-600 text-[11px]">
                        {selectedEventDetails.notesTitle}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      alert(`Downloading resource: ${selectedEventDetails.notesTitle}`);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedEventDetails(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Lecture Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Schedule Lecture or Exam Slot
              </h3>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Course Code
                  </label>
                  <select
                    value={newCourseCode}
                    onChange={(e) => {
                      setNewCourseCode(e.target.value);
                      if (e.target.value === 'CS101') setNewCourseName('Introduction to Computer Science');
                      if (e.target.value === 'MATH201') setNewCourseName('Calculus I');
                      if (e.target.value === 'PHYS101') setNewCourseName('Physics for Engineers');
                      if (e.target.value === 'ENG101') setNewCourseName('Academic Writing');
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                  >
                    <option value="CS101">CS101</option>
                    <option value="MATH201">MATH201</option>
                    <option value="PHYS101">PHYS101</option>
                    <option value="ENG101">ENG101</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as LectureEventType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Lab">Lab</option>
                    <option value="Discussion">Discussion</option>
                    <option value="Exam">Exam</option>
                    <option value="Tutorial">Tutorial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    required
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="text"
                    required
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Location / Room
                  </label>
                  <input
                    type="text"
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Faculty Instructor
                  </label>
                  <input
                    type="text"
                    required
                    value={newFaculty}
                    onChange={(e) => setNewFaculty(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Unit Topic / Coverage
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 3: Dynamic Programming Recurrences"
                  value={newUnitTopic}
                  onChange={(e) => setNewUnitTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded"
                >
                  Add to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
