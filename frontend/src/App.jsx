import React, { useState, useEffect } from "react";

import {
  GUEST_STUDENT_USER,
  INITIAL_COURSES,
  INITIAL_ASSIGNMENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_LECTURE_EVENTS,
  INITIAL_DOUBT_QUESTIONS,
  INITIAL_PYQ_TOPICS,
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
  const [currentUser, setCurrentUser] = useState(GUEST_STUDENT_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentTab, setCurrentTab] = useState("dashboard");

  // Dynamic application data state
  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [announcements, setAnnouncements] = useState(INITIAL_ANNOUNCEMENTS);
  const [lectureEvents, setLectureEvents] = useState(INITIAL_LECTURE_EVENTS);
  const [doubtQuestions, setDoubtQuestions] = useState(INITIAL_DOUBT_QUESTIONS);

  useEffect(() => {
    api.getCurrentUser()
      .then((user) => {
        if (!user) return;
        setCurrentUser(user);
        setIsAuthenticated(true);
        setCurrentTab(
          user.role === "faculty"
            ? "faculty-tools"
            : user.role === "admin"
              ? "admin-panel"
              : "dashboard",
        );
      })
      .catch((error) => {
        console.error("Unable to restore the current session:", error);
      });
  }, []);

  // Sync with the backend only after an authenticated session is available.
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const [fetchedCourses, fetchedAssignments, fetchedDoubts, fetchedNotifications] =
          await Promise.all([
            api.getCourses().catch(() => null),
            api.getAssignments().catch(() => null),
            api.getDoubts().catch(() => null),
            api.getAssignmentNotifications().catch(() => null),
          ]);

        if (Array.isArray(fetchedCourses) && fetchedCourses.length > 0) {
          setCourses(fetchedCourses);
        }
        if (Array.isArray(fetchedAssignments)) {
          setAssignments(fetchedAssignments);
        }
        if (Array.isArray(fetchedDoubts) && fetchedDoubts.length > 0) {
          setDoubtQuestions(fetchedDoubts);
        }
        if (Array.isArray(fetchedNotifications?.items)) {
          setNotifications(fetchedNotifications.items);
        }
      } catch (err) {
        console.warn("Backend sync fallback to mock data:", err);
      }
    }
    loadData();
  }, [isAuthenticated]);

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
  const [adminDashboardRefreshKey, setAdminDashboardRefreshKey] = useState(0);

  const handleAuthenticationRequired = () => {
    setIsAuthenticated(false);
    setIsAuthModalOpen(true);
  };

  // Unread count
  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

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

  const handleGradeAssignment = async (submissionId, marks, feedback) => {
    await api.gradeAssignment(submissionId, { obtainedMarks: marks, feedback });
  };

  // Notifications drawer actions
  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (isAuthenticated) api.markAllAssignmentNotificationsRead().catch((error) => {
      console.warn("Unable to mark assignment notifications as read:", error);
    });
  };

  const handleDismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (isAuthenticated && /^[a-f\d]{24}$/i.test(id)) {
      api.deleteAssignmentNotification(id).catch((error) => {
        console.warn("Unable to dismiss assignment notification:", error);
      });
    }
  };

  const handleOpenNotifications = async () => {
    setIsNotificationsOpen(true);
    if (!isAuthenticated) return;
    try {
      const result = await api.getAssignmentNotifications();
      setNotifications(result.items || []);
    } catch (error) {
      console.warn("Unable to refresh assignment notifications:", error);
    }
  };

  // Role authentication change
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(!user.isGuest);
    if (user.role === "faculty") {
      setCurrentTab("faculty-tools");
    } else if (user.role === "admin") {
      setCurrentTab("admin-panel");
    } else if (currentTab !== "pyq" && currentTab !== "ai-chat") {
      setCurrentTab("dashboard");
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(GUEST_STUDENT_USER);
      setIsAuthenticated(false);
      setCurrentTab("dashboard");
    } catch (error) {
      window.alert(error.message);
    }
  };

  const openDomainModal = () => {
    if (currentUser?.role === "admin") setIsDomainModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top banner: institution and custom-domain status */}
      <InstitutionalBanner
        currentUser={currentUser}
        onOpenDomainSettings={openDomainModal}
        refreshKey={adminDashboardRefreshKey}
      />

      {/* Strict 3-Zone Navigation Header */}
      <Header
        currentUser={currentUser}
        isAuthenticated={isAuthenticated}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenNotifications={handleOpenNotifications}
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
            currentUser={currentUser}
            onAuthenticationRequired={handleAuthenticationRequired}
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
            isAuthenticated={isAuthenticated}
            onAuthenticationRequired={handleAuthenticationRequired}
          />
        )}

        {currentTab === "ai-chat" &&
          (isAuthenticated ? (
            <GeminiChatbot onAuthenticationRequired={handleAuthenticationRequired} />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
              <h1 className="text-xl font-bold text-slate-900">Sign in to use AI chat</h1>
              <p className="mt-2 text-sm text-slate-600">
                Your guest demo can browse the academic tools. Sign in to send messages to Gemini.
              </p>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="mt-5 rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Sign in
              </button>
            </div>
          ))}

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
            refreshKey={adminDashboardRefreshKey}
            onOpenDomainModal={openDomainModal}
            onDashboardUpdated={() => setAdminDashboardRefreshKey((key) => key + 1)}
          />
        )}
      </main>

      {/* Footer with Legal & Institutional Links */}
      <Footer
        currentUser={currentUser}
        onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
        onOpenTerms={() => setIsTermsModalOpen(true)}
        onOpenDomainModal={openDomainModal}
      />

      {/* Modals and Drawers */}
      {isDomainModalOpen && currentUser?.role === "admin" && (
        <CustomDomainModal
          onChanged={() => setAdminDashboardRefreshKey((key) => key + 1)}
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
