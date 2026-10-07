import React, { useState, useEffect } from "react";

import {
  INITIAL_STUDENT_USER,
  INITIAL_COURSES,
  INITIAL_ASSIGNMENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_LECTURE_EVENTS,
  INITIAL_DOUBT_QUESTIONS,
  INITIAL_PYQ_TOPICS,
  INITIAL_DOMAIN_RECORD,
} from "./data/mockData.js";
import { api } from "./services/api.js";

import { Header } from "./components/Header.jsx";
import { InstitutionalBanner } from "./components/InstitutionalBanner.jsx";
import { StudentDashboard } from "./components/StudentDashboard.jsx";
import { GpaPredictionEngine } from "./components/GpaPredictionEngine.jsx";
import { AssignmentTracker } from "./components/AssignmentTracker.jsx";
import { LectureCalendar } from "./components/LectureCalendar.jsx";
import { DoubtSupportSystem } from "./components/DoubtSupportSystem.jsx";
import { PyqSyllabusAnalyzer } from "./components/PyqSyllabusAnalyzer.jsx";
import { FacultyDashboard } from "./components/FacultyDashboard.jsx";
import { AdminDashboard } from "./components/AdminDashboard.jsx";
import { CustomDomainModal } from "./components/CustomDomainModal.jsx";
import { PrivacyPolicyModal } from "./components/PrivacyPolicyModal.jsx";
import { TermsModal } from "./components/TermsModal.jsx";
import { AuthModal } from "./components/AuthModal.jsx";
import { NotificationDrawer } from "./components/NotificationDrawer.jsx";
import { Footer } from "./components/Footer.jsx";
import { GeminiChatbot } from "./components/GeminiChatbot.jsx";
import { VoiceConversationModal } from "./components/VoiceConversationModal.jsx";
// server code

export default function App() {
  // Current logged in user (defaults to Kshitij Jaiswal, author of the report)
  const [currentUser, setCurrentUser] = useState(INITIAL_STUDENT_USER);
  const [currentTab, setCurrentTab] = useState("dashboard");

  // Dynamic application data state
  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [lectureEvents, setLectureEvents] = useState(INITIAL_LECTURE_EVENTS);
  const [doubtQuestions, setDoubtQuestions] = useState(INITIAL_DOUBT_QUESTIONS);
  const [domainRecord, setDomainRecord] = useState(INITIAL_DOMAIN_RECORD);

  // Sync with Express + MongoDB backend on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [fetchedCourses, fetchedAssignments, fetchedDoubts] =
          await Promise.all([
            api.getCourses().catch(() => null),
            api.getAssignments().catch(() => null),
            api.getDoubts().catch(() => null),
          ]);

        if (Array.isArray(fetchedCourses) && fetchedCourses.length > 0) {
          setCourses(fetchedCourses);
        }
        if (
          Array.isArray(fetchedAssignments) &&
          fetchedAssignments.length > 0
        ) {
          setAssignments(fetchedAssignments);
        }
        if (Array.isArray(fetchedDoubts) && fetchedDoubts.length > 0) {
          setDoubtQuestions(fetchedDoubts);
        }
      } catch (err) {
        console.warn("Backend sync fallback to mock data:", err);
      }
    }
    loadData();
  }, []);

  // Notifications
  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      title: "Lab Report 2 Evaluated",
      message: "Ms. Deepika Yadav marked your Lab Report 2: 94/100.",
      time: "10 mins ago",
      read: false,
      category: "grade",
    },
    {
      id: "notif-2",
      title: "Upcoming Assessment Reminder",
      message: "Calculus Problem Set 4 submission is due within 48 hours.",
      time: "2 hours ago",
      read: false,
      category: "assignment",
    },
    {
      id: "notif-3",
      title: "Doubt Resolved",
      message:
        "Ms. Deepika Yadav provided guidance on your binary search tree query.",
      time: "1 day ago",
      read: true,
      category: "doubt",
    },
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
  const handleAddAssignment = async (newAsg) => {
    const id = `asg-${Date.now()}`;
    const asgObject = { ...newAsg, id };
    setAssignments((prev) => [asgObject, ...prev]);

    // Async sync with backend
    try {
      await api.createAssignment(asgObject);
    } catch (_) {}

    // Push real notification
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: "New Assignment Added",
        message: `${newAsg.title} added to ${newAsg.courseCode} syllabus.`,
        time: "Just now",
        read: false,
        category: "assignment",
      },
      ...prev,
    ]);
  };

  const handleUpdateAssignment = async (updated) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
    try {
      await api.updateAssignment(updated.id, updated);
    } catch (_) {}
  };

  const handleSubmitWork = async (assignmentId, fileName) => {
    let updatedTarget = null;
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          updatedTarget = {
            ...a,
            status: "Completed",
            submittedFileName: fileName,
            submissionDate: new Date().toISOString().split("T")[0],
          };
          return updatedTarget;
        }
        return a;
      }),
    );

    if (updatedTarget) {
      try {
        await api.updateAssignment(assignmentId, updatedTarget);
      } catch (_) {}
    }

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: "Deliverable Submitted",
        message: `Successfully uploaded ${fileName} for grading.`,
        time: "Just now",
        read: false,
        category: "assignment",
      },
      ...prev,
    ]);
  };

  // Handlers for doubt support
  const handleAddQuestion = async (newQ) => {
    const id = `dbt-${Date.now()}`;
    const questionObject = { ...newQ, id, replies: [] };
    setDoubtQuestions((prev) => [questionObject, ...prev]);

    try {
      await api.createDoubtQuestion(questionObject);
    } catch (_) {}
  };

  const handleAddReply = async (questionId, replyText) => {
    const isFaculty = currentUser.role === "faculty";
    const newReply = {
      id: `rep-${Date.now()}`,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      text: replyText,
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      isFacultyResponse: isFaculty,
    };

    setDoubtQuestions((prev) =>
      prev.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            status: isFaculty ? "Answered" : q.status,
            replies: [...q.replies, newReply],
          };
        }
        return q;
      }),
    );

    try {
      await api.addDoubtReply(questionId, newReply);
    } catch (_) {}
  };

  // Lecture calendar events
  const handleAddLectureEvent = (newEvent) => {
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
  const handleUpdateCourse = async (updatedCourse) => {
    setCourses((prev) =>
      prev.map((c) => (c.code === updatedCourse.code ? updatedCourse : c)),
    );
    try {
      await api.updateCourse(updatedCourse.code, updatedCourse);
    } catch (_) {}
  };

  const handleGradeAssignment = async (assignmentId, marks, feedback) => {
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id === assignmentId) {
          const updated = {
            ...a,
            obtainedMarks: marks,
            feedback,
            status: "Completed",
          };
          api.updateAssignment(assignmentId, updated).catch(() => {});
          return updated;
        }
        return a;
      }),
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: "Assignment Graded",
        message: `Evaluation completed: ${marks} marks recorded.`,
        time: "Just now",
        read: false,
        category: "grade",
      },
      ...prev,
    ]);
  };

  // Custom domain updater
  const handleUpdateDomain = (newDomain) => {
    setDomainRecord((prev) => ({
      ...prev,
      domain: newDomain,
      status: "active",
      sslActive: true,
      connectedAt: new Date().toISOString(),
    }));
  };

  // Notifications drawer actions
  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Role authentication change
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === "faculty") {
      setCurrentTab("faculty-tools");
    } else if (user.role === "admin") {
      setCurrentTab("admin-panel");
    } else {
      setCurrentTab("dashboard");
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
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onLogout={handleLogout}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        assignments={assignments}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {currentTab === "dashboard" && (
          <StudentDashboard
            currentUser={currentUser}
            courses={courses}
            assignments={assignments}
            announcements={announcements}
            lectureEvents={lectureEvents}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === "gpa" && <GpaPredictionEngine courses={courses} />}

        {currentTab === "assignments" && (
          <AssignmentTracker
            assignments={assignments}
            courses={courses}
            onAddAssignment={handleAddAssignment}
            onUpdateAssignment={handleUpdateAssignment}
            onSubmitWork={handleSubmitWork}
          />
        )}

        {currentTab === "calendar" && (
          <LectureCalendar
            events={lectureEvents}
            userRole={currentUser.role}
            onAddEvent={handleAddLectureEvent}
          />
        )}

        {currentTab === "doubts" && (
          <DoubtSupportSystem
            currentUser={currentUser}
            courses={courses}
            questions={doubtQuestions}
            onAddQuestion={handleAddQuestion}
            onAddReply={handleAddReply}
          />
        )}

        {currentTab === "pyq" && (
          <PyqSyllabusAnalyzer
            courses={courses}
            pyqTopics={INITIAL_PYQ_TOPICS}
          />
        )}

        {currentTab === "ai-chat" && <GeminiChatbot />}

        {currentTab === "faculty-tools" && (
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

        {currentTab === "admin-panel" && (
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
