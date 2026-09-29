import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Assignment } from '../types/academic';
import { Bell, Globe, LogOut, UserCheck, Mic, Bot, AlertTriangle, ArrowRight } from 'lucide-react';
import { getDueSoonAssignments, formatTimeRemaining, formatDueDateTime } from '../utils/deadline';

interface HeaderProps {
  currentUser: UserProfile;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenDomainModal: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
  onLogout: () => void;
  onOpenAuthModal: () => void;
  onOpenVoiceModal: () => void;
  assignments: Assignment[];
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  currentTab,
  onSelectTab,
  onOpenDomainModal,
  onOpenNotifications,
  unreadNotificationsCount,
  onLogout,
  onOpenAuthModal,
  onOpenVoiceModal,
  assignments,
}) => {
  const [isDueSoonOpen, setIsDueSoonOpen] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const dueSoonRef = useRef<HTMLDivElement>(null);

  // Periodically refresh current time to keep countdown accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dueSoonRef.current && !dueSoonRef.current.contains(event.target as Node)) {
        setIsDueSoonOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
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
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Single text element wordmark */}
          <button
            onClick={() => onSelectTab('dashboard')}
            className="text-xl font-bold tracking-tight text-blue-900 hover:text-blue-800 transition-colors text-left"
          >
            AcadLytic
          </button>

          {/* Zone 2: Clean text navigation links */}
          <nav className="hidden lg:flex items-center space-x-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`transition-colors pb-1 border-b-2 ${
                currentTab === 'dashboard'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onSelectTab('gpa')}
              className={`transition-colors pb-1 border-b-2 ${
                currentTab === 'gpa'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              GPA Prediction
            </button>
            <button
              onClick={() => onSelectTab('assignments')}
              className={`transition-colors pb-1 border-b-2 flex items-center gap-1.5 ${
                currentTab === 'assignments'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Assignments</span>
              {dueSoonAssignments.length > 0 && (
                <span
                  className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded tracking-wide"
                  title={`${dueSoonAssignments.length} assignment${dueSoonAssignments.length > 1 ? 's' : ''} deadline within 24 hours`}
                >
                  {dueSoonAssignments.length} DUE SOON
                </span>
              )}
            </button>
            <button
              onClick={() => onSelectTab('calendar')}
              className={`transition-colors pb-1 border-b-2 ${
                currentTab === 'calendar'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Calendar
            </button>
            <button
              onClick={() => onSelectTab('doubts')}
              className={`transition-colors pb-1 border-b-2 ${
                currentTab === 'doubts'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Doubt Support
            </button>
            <button
              onClick={() => onSelectTab('pyq')}
              className={`transition-colors pb-1 border-b-2 ${
                currentTab === 'pyq'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              PYQ & Syllabus
            </button>
            <button
              onClick={() => onSelectTab('ai-chat')}
              className={`transition-colors pb-1 border-b-2 flex items-center gap-1.5 ${
                currentTab === 'ai-chat'
                  ? 'border-blue-700 text-blue-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-4 h-4 text-blue-700" />
              <span>AI Consultation</span>
            </button>

            {currentUser.role === 'faculty' && (
              <button
                onClick={() => onSelectTab('faculty-tools')}
                className={`transition-colors pb-1 border-b-2 ${
                  currentTab === 'faculty-tools'
                    ? 'border-blue-700 text-blue-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Faculty Tools
              </button>
            )}

            {currentUser.role === 'admin' && (
              <button
                onClick={() => onSelectTab('admin-panel')}
                className={`transition-colors pb-1 border-b-2 ${
                  currentTab === 'admin-panel'
                    ? 'border-blue-700 text-blue-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Admin Console
              </button>
            )}
          </nav>

          {/* Zone 3: Primary actions & profile status */}
          <div className="flex items-center space-x-3">
            {/* High-Priority 'Due Soon' Alert Badge */}
            {dueSoonAssignments.length > 0 && (
              <div className="relative" ref={dueSoonRef}>
                <button
                  onClick={() => setIsDueSoonOpen((prev) => !prev)}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 cursor-pointer"
                  title="High-Priority Alert: Assignment deadline is within 24 hours"
                  aria-label={`High-priority alert: ${dueSoonAssignments.length} assignment${dueSoonAssignments.length > 1 ? 's' : ''} deadline within 24 hours`}
                  aria-expanded={isDueSoonOpen}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="tracking-tight">Due Soon</span>
                  <span className="bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded text-[11px] font-mono font-bold">
                    {dueSoonAssignments.length}
                  </span>
                  {earliestDueSoon && (
                    <span className="hidden xl:inline text-rose-700 font-normal border-l border-rose-300 pl-1.5 text-[11px]">
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
                              className="text-xs font-bold text-slate-900 hover:text-blue-700 text-left transition-colors"
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors shadow-sm"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Voice</span>
            </button>

            <button
              onClick={onOpenDomainModal}
              title="Custom Domain Configuration"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-slate-600" />
              <span>Domain</span>
            </button>

            <button
              onClick={onOpenNotifications}
              title="Notifications"
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" />
              )}
            </button>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 text-left hover:bg-slate-50 p-1.5 rounded-md transition-colors"
                title="Switch active user or role"
              >
                <div className="w-7 h-7 bg-blue-900 text-white text-xs font-semibold flex items-center justify-center rounded">
                  {currentUser.avatarInitials}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-900 leading-none">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-slate-500 capitalize leading-tight mt-0.5">
                    {currentUser.role}
                  </div>
                </div>
              </button>

              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="lg:hidden flex items-center space-x-4 overflow-x-auto py-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
              currentTab === 'dashboard' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('gpa')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
              currentTab === 'gpa' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            GPA Engine
          </button>
          <button
            onClick={() => onSelectTab('assignments')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 ${
              currentTab === 'assignments' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Assignments</span>
            {dueSoonAssignments.length > 0 && (
              <span
                className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${
                  currentTab === 'assignments' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {dueSoonAssignments.length} Due Soon
              </span>
            )}
          </button>
          <button
            onClick={() => onSelectTab('calendar')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
              currentTab === 'calendar' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => onSelectTab('doubts')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
              currentTab === 'doubts' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Doubts
          </button>
          <button
            onClick={() => onSelectTab('pyq')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
              currentTab === 'pyq' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            PYQ & Syllabus
          </button>
          <button
            onClick={() => onSelectTab('ai-chat')}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
              currentTab === 'ai-chat' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            AI Consultation
          </button>
          {currentUser.role === 'faculty' && (
            <button
              onClick={() => onSelectTab('faculty-tools')}
              className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
                currentTab === 'faculty-tools' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Faculty Tools
            </button>
          )}
          {currentUser.role === 'admin' && (
            <button
              onClick={() => onSelectTab('admin-panel')}
              className={`whitespace-nowrap px-2.5 py-1 rounded-md font-medium ${
                currentTab === 'admin-panel' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Admin
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
