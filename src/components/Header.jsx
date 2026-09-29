import React, { useState, useEffect, useRef } from 'react';
import { Bell, Globe, LogOut, Mic, Bot, AlertTriangle, ArrowRight } from 'lucide-react';
import { getDueSoonAssignments, formatTimeRemaining, formatDueDateTime } from '../utils/deadline.js';

export const Header = ({
  currentUser,
  currentTab,
  onSelectTab,
  onOpenDomainModal,
  onOpenNotifications,
  unreadNotificationsCount,
  onLogout,
  onOpenAuthModal,
  onOpenVoiceModal,
  assignments = [],
}) => {
  const [isDueSoonOpen, setIsDueSoonOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const dueSoonRef = useRef(null);

  // Periodically refresh current time to keep countdown accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dueSoonRef.current && !dueSoonRef.current.contains(event.target)) {
        setIsDueSoonOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDueSoonOpen(false);
      }
    }
    if (isDueSoonOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDueSoonOpen]);

  // Compute pending assignments due within 24 hours
  const dueSoonAssignments = getDueSoonAssignments(assignments, now);
  const earliestDueSoon = dueSoonAssignments[0];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 lg:gap-4 xl:gap-6">
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 shrink-0 text-left group focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 rounded-lg py-1 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:bg-blue-800 transition-colors">
              A
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-blue-900 group-hover:text-blue-800 transition-colors leading-none">
                AcadLytic
              </span>
              <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase leading-none mt-1 hidden sm:block">
                Academic Hub
              </span>
            </div>
          </button>

          {/* Zone 2: Navigation Links with full-height border alignment and adaptive spacing */}
          <nav className="hidden lg:flex items-center h-full gap-0.5 xl:gap-1 text-sm font-medium">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onSelectTab('gpa')}
              className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'gpa'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>GPA<span className="hidden xl:inline"> Prediction</span></span>
            </button>
            <button
              onClick={() => onSelectTab('assignments')}
              className={`h-full inline-flex items-center gap-1.5 px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'assignments'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>Assignments</span>
              {dueSoonAssignments.length > 0 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded tracking-tight"
                  title={`${dueSoonAssignments.length} assignment${dueSoonAssignments.length > 1 ? 's' : ''} deadline within 24 hours`}
                >
                  <span className="hidden xl:inline">{dueSoonAssignments.length} DUE SOON</span>
                  <span className="xl:hidden">{dueSoonAssignments.length}</span>
                </span>
              )}
            </button>
            <button
              onClick={() => onSelectTab('calendar')}
              className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'calendar'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => onSelectTab('doubts')}
              className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'doubts'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>Doubt<span className="hidden xl:inline"> Support</span></span>
            </button>
            <button
              onClick={() => onSelectTab('pyq')}
              className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'pyq'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <span>PYQ<span className="hidden xl:inline"> & Syllabus</span></span>
            </button>
            <button
              onClick={() => onSelectTab('ai-chat')}
              className={`h-full inline-flex items-center gap-1.5 px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                currentTab === 'ai-chat'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Bot className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-blue-700 shrink-0" />
              <span>AI<span className="hidden xl:inline"> Consultation</span></span>
            </button>

            {currentUser?.role === 'faculty' && (
              <button
                onClick={() => onSelectTab('faculty-tools')}
                className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                  currentTab === 'faculty-tools'
                    ? 'border-blue-700 text-blue-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>Faculty<span className="hidden xl:inline"> Tools</span></span>
              </button>
            )}

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => onSelectTab('admin-panel')}
                className={`h-full inline-flex items-center px-2.5 xl:px-3 border-b-2 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap -mb-px cursor-pointer ${
                  currentTab === 'admin-panel'
                    ? 'border-blue-700 text-blue-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>Admin<span className="hidden xl:inline"> Console</span></span>
              </button>
            )}
          </nav>

          {/* Zone 3: Primary actions & profile status */}
          <div className="flex items-center gap-1.5 sm:gap-2 xl:gap-3 shrink-0">
            {/* High-Priority 'Due Soon' Alert Badge */}
            {dueSoonAssignments.length > 0 && (
              <div className="relative" ref={dueSoonRef}>
                <button
                  onClick={() => setIsDueSoonOpen((prev) => !prev)}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 cursor-pointer"
                  title="High-Priority Alert: Assignment deadline is within 24 hours"
                  aria-label={`High-priority alert: ${dueSoonAssignments.length} assignment${dueSoonAssignments.length > 1 ? 's' : ''} deadline within 24 hours`}
                  aria-expanded={isDueSoonOpen}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="tracking-tight hidden sm:inline">Due Soon</span>
                  <span className="bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded text-[11px] font-mono font-bold">
                    {dueSoonAssignments.length}
                  </span>
                  {earliestDueSoon && (
                    <span className="hidden 2xl:inline text-rose-700 font-normal border-l border-rose-300 pl-1.5 text-[11px]">
                      {formatTimeRemaining(earliestDueSoon.dueDate, now)}
                    </span>
                  )}
                </button>

                {/* Dropdown Popover */}
                {isDueSoonOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-rose-200 rounded-lg shadow-xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between pb-2.5 border-b border-rose-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                          Due Within 24 Hours
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        High Priority
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 mt-2 max-h-72 overflow-y-auto">
                      {dueSoonAssignments.map((asg) => (
                        <div key={asg.id} className="py-2.5 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => {
                                setIsDueSoonOpen(false);
                                onSelectTab('assignments');
                              }}
                              className="text-xs font-bold text-slate-900 hover:text-blue-700 text-left transition-colors cursor-pointer"
                            >
                              {asg.title}
                            </button>
                            <span className="shrink-0 text-[11px] font-mono font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {formatTimeRemaining(asg.dueDate, now)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono font-semibold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded">
                              {asg.courseCode} · {asg.weightPercent}% weight
                            </span>
                            <span>Due: {formatDueDateTime(asg.dueDate)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Submit solution to clear alert
                      </span>
                      <button
                        onClick={() => {
                          setIsDueSoonOpen(false);
                          onSelectTab('assignments');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors cursor-pointer"
                      >
                        <span>View in Tracker</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onOpenVoiceModal}
              title="Start Live Voice Conversation with gemini-3.8-live"
              className="inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs shrink-0 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Live Voice</span>
            </button>

            <button
              onClick={onOpenDomainModal}
              title="Custom Domain Configuration"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="hidden xl:inline">Domain</span>
            </button>

            <button
              onClick={onOpenNotifications}
              title="Notifications"
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4 xl:w-5 xl:h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full ring-2 ring-white" />
              )}
            </button>

            <div className="h-6 w-px bg-slate-200 mx-0.5 xl:mx-1 shrink-0" />

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 text-left hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Switch active user or role"
              >
                <div className="w-7 h-7 bg-blue-900 text-white text-xs font-semibold flex items-center justify-center rounded-md shrink-0">
                  {currentUser?.avatarInitials || 'KJ'}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[90px] xl:max-w-[130px]">
                    {currentUser?.name || 'Student'}
                  </div>
                  <div className="text-[10px] text-slate-500 capitalize leading-tight mt-0.5">
                    {currentUser?.role || 'student'}
                  </div>
                </div>
              </button>

              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto py-2.5 px-0.5 border-t border-slate-100 text-xs">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              currentTab === 'dashboard' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('gpa')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              currentTab === 'gpa' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            GPA Engine
          </button>
          <button
            onClick={() => onSelectTab('assignments')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'assignments' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>Assignments</span>
            {dueSoonAssignments.length > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
                  currentTab === 'assignments' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {dueSoonAssignments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => onSelectTab('calendar')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              currentTab === 'calendar' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => onSelectTab('doubts')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              currentTab === 'doubts' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Doubt Support
          </button>
          <button
            onClick={() => onSelectTab('pyq')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
              currentTab === 'pyq' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            PYQ & Syllabus
          </button>
          <button
            onClick={() => onSelectTab('ai-chat')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'ai-chat' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Consultation</span>
          </button>
          {currentUser?.role === 'faculty' && (
            <button
              onClick={() => onSelectTab('faculty-tools')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                currentTab === 'faculty-tools' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Faculty Tools
            </button>
          )}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onSelectTab('admin-panel')}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                currentTab === 'admin-panel' ? 'bg-blue-900 text-white font-semibold shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Admin Console
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
