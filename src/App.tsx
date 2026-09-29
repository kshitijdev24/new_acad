import React, { useState } from 'react';
import {
  UserProfile,
  Course,
  Assignment,
  LectureEvent,
  DoubtQuestion,
  DomainRecord,
  AcademicAnnouncement
} from './types/academic';
import {
  INITIAL_STUDENT_USER,
  INITIAL_COURSES,
  INITIAL_ASSIGNMENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_LECTURE_EVENTS,
  INITIAL_DOUBT_QUESTIONS,
  INITIAL_PYQ_TOPICS,
  INITIAL_DOMAIN_RECORD
} from './data/mockData';

import { Header } from './components/Header';
import { InstitutionalBanner } from './components/InstitutionalBanner';
import { StudentDashboard } from './components/StudentDashboard';
import { GpaPredictionEngine } from './components/GpaPredictionEngine';
import { AssignmentTracker } from './components/AssignmentTracker';
import { LectureCalendar } from './components/LectureCalendar';
import { DoubtSupportSystem } from './components/DoubtSupportSystem';
import { PyqSyllabusAnalyzer } from './components/PyqSyllabusAnalyzer';
import { FacultyDashboard } from './components/FacultyDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CustomDomainModal } from './components/CustomDomainModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { TermsModal } from './components/TermsModal';
import { AuthModal } from './components/AuthModal';
import { NotificationDrawer, NotificationItem } from './components/NotificationDrawer';
import { Footer } from './components/Footer';
import { GeminiChatbot } from './components/GeminiChatbot';
import { VoiceConversationModal } from './components/VoiceConversationModal';

export default function App() {
  // Current logged in user (defaults to Kshitij Jaiswal, author of the report)
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_STUDENT_USER);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Dynamic application data state
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [announcements] = useState<AcademicAnnouncement[]>(INITIAL_ANNOUNCEMENTS);
  const [lectureEvents, setLectureEvents] = useState<LectureEvent[]>(INITIAL_LECTURE_EVENTS);
  const [doubtQuestions, setDoubtQuestions] = useState<DoubtQuestion[]>(INITIAL_DOUBT_QUESTIONS);
  const [domainRecord, setDomainRecord] = useState<DomainRecord>(INITIAL_DOMAIN_RECORD);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Lab Report 2 Evaluated',
      message: 'Ms. Deepika Yadav marked your Lab Report 2: 94/100.',
      time: '10 mins ago',
      read: false,
      category: 'grade'
    },
    {
      id: 'notif-2',
      title: 'Upcoming Assessment Reminder',
      message: 'Calculus Problem Set 4 submission is due within 48 hours.',
      time: '2 hours ago',
      read: false,
      category: 'assignment'
    },
    {
      id: 'notif-3',
      title: 'Doubt Resolved',
      message: 'Ms. Deepika Yadav provided guidance on your binary search tree query.',
      time: '1 day ago',
      read: true,
      category: 'doubt'
    }
  ]);

  // Modal display states
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Unread count
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // Handlers for assignments
  const handleAddAssignment = (newAsg: Omit<Assignment, 'id'>) => {
    const id = `asg-${Date.now()}`;
    setAssignments((prev) => [
      {
        ...newAsg,
        id,
      },
      ...prev,
    ]);

    // Push real notification
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'New Assignment Added',
        message: `${newAsg.title} added to ${newAsg.courseCode} syllabus.`,
        time: 'Just now',
        read: false,
        category: 'assignment',
      },
      ...prev,
    ]);
  };

  const handleUpdateAssignment = (updated: Assignment) => {
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleSubmitWork = (assignmentId: string, fileName: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            status: 'Completed',
            submittedFileName: fileName,
            submissionDate: new Date().toISOString().split('T')[0],
          };
        }
        return a;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Deliverable Submitted',
        message: `Successfully uploaded ${fileName} for grading.`,
        time: 'Just now',
        read: false,
        category: 'assignment',
      },
      ...prev,
    ]);
  };

  // Handlers for doubt support
  const handleAddQuestion = (newQ: Omit<DoubtQuestion, 'id' | 'replies'>) => {
    const id = `dbt-${Date.now()}`;
    setDoubtQuestions((prev) => [
      {
        ...newQ,
        id,
        replies: [],
      },
      ...prev,
    ]);
  };

  const handleAddReply = (questionId: string, replyText: string) => {
    const isFaculty = currentUser.role === 'faculty';
    const newReply = {
      id: `rep-${Date.now()}`,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      text: replyText,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      isFacultyResponse: isFaculty,
    };

    setDoubtQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            status: isFaculty ? 'Answered' : q.status,
            replies: [...q.replies, newReply],
          };
        }
        return q;
      })
    );
  };

  // Lecture calendar events
  const handleAddLectureEvent = (newEvent: Omit<LectureEvent, 'id'>) => {
    const id = `lec-${Date.now()}`;
    setLectureEvents((prev) => [
      ...prev,
      {
        ...newEvent,
        id,
      },
    ]);
  };

  // Faculty course updates
  const handleUpdateCourse = (updatedCourse: Course) => {
    setCourses((prev) =>
      prev.map((c) => (c.code === updatedCourse.code ? updatedCourse : c))
    );
  };

  const handleGradeAssignment = (assignmentId: string, marks: number, feedback: string) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          return {
            ...a,
            obtainedMarks: marks,
            feedback,
            status: 'Completed',
          };
        }
        return a;
      })
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Assignment Graded',
        message: `Evaluation completed: ${marks} marks recorded.`,
        time: 'Just now',
        read: false,
        category: 'grade',
      },
      ...prev,
    ]);
  };

  // Custom domain updater
  const handleUpdateDomain = (newDomain: string) => {
    setDomainRecord((prev) => ({
      ...prev,
      domain: newDomain,
      status: 'active',
      sslActive: true,
      connectedAt: new Date().toISOString(),
    }));
  };

  // Notifications drawer actions
  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Role authentication change
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.role === 'faculty') {
      setCurrentTab('faculty-tools');
    } else if (user.role === 'admin') {
      setCurrentTab('admin-panel');
    } else {
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Banner: Bharati Vidyapeeth's College of Engineering & Domain Badge */}
      <InstitutionalBanner
        currentUser={currentUser}
        domainRecord={domainRecord}
        onOpenDomainSettings={() => setIsDomainModalOpen(true)}
      />

      {/* Strict 3-Zone Navigation Header */}
      <Header
        currentUser={currentUser}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenDomainModal={() => setIsDomainModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onLogout={handleLogout}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        assignments={assignments}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentTab === 'dashboard' && (
          <StudentDashboard
            currentUser={currentUser}
            courses={courses}
            assignments={assignments}
            announcements={announcements}
            lectureEvents={lectureEvents}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'gpa' && (
          <GpaPredictionEngine courses={courses} />
        )}

        {currentTab === 'assignments' && (
          <AssignmentTracker
            assignments={assignments}
            courses={courses}
            onAddAssignment={handleAddAssignment}
            onUpdateAssignment={handleUpdateAssignment}
            onSubmitWork={handleSubmitWork}
          />
        )}

        {currentTab === 'calendar' && (
          <LectureCalendar
            events={lectureEvents}
            userRole={currentUser.role}
            onAddEvent={handleAddLectureEvent}
          />
        )}

        {currentTab === 'doubts' && (
          <DoubtSupportSystem
            currentUser={currentUser}
            courses={courses}
            questions={doubtQuestions}
            onAddQuestion={handleAddQuestion}
            onAddReply={handleAddReply}
          />
        )}

        {currentTab === 'pyq' && (
          <PyqSyllabusAnalyzer
            courses={courses}
            pyqTopics={INITIAL_PYQ_TOPICS}
          />
        )}

        {currentTab === 'ai-chat' && (
          <GeminiChatbot />
        )}

        {currentTab === 'faculty-tools' && (
          <FacultyDashboard
            currentUser={currentUser}
            courses={courses}
            assignments={assignments}
            questions={doubtQuestions}
            onUpdateCourse={handleUpdateCourse}
            onGradeAssignment={handleGradeAssignment}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'admin-panel' && (
          <AdminDashboard
            currentUser={currentUser}
            domainRecord={domainRecord}
            courses={courses}
            onOpenDomainModal={() => setIsDomainModalOpen(true)}
          />
        )}
      </main>

      {/* Footer with Legal & Institutional Links */}
      <Footer
        domainRecord={domainRecord}
        onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
        onOpenTerms={() => setIsTermsModalOpen(true)}
        onOpenDomainModal={() => setIsDomainModalOpen(true)}
      />

      {/* Modals and Drawers */}
      {isDomainModalOpen && (
        <CustomDomainModal
          domainRecord={domainRecord}
          onUpdateDomain={handleUpdateDomain}
          onClose={() => setIsDomainModalOpen(false)}
        />
      )}

      {isPrivacyModalOpen && (
        <PrivacyPolicyModal onClose={() => setIsPrivacyModalOpen(false)} />
      )}

      {isTermsModalOpen && (
        <TermsModal onClose={() => setIsTermsModalOpen(false)} />
      )}

      {isAuthModalOpen && (
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {isNotificationsOpen && (
        <NotificationDrawer
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllRead}
          onDismiss={handleDismissNotification}
        />
      )}

      {isVoiceModalOpen && (
        <VoiceConversationModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
        />
      )}
    </div>
  );
}
