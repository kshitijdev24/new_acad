export type UserRole = 'student' | 'faculty' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  enrollmentNumber?: string;
  department: string;
  semester: number;
  institution: string;
  avatarInitials: string;
}

export type GradeLetter = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'F';

export interface Course {
  code: string;
  name: string;
  credits: number;
  currentGrade: GradeLetter;
  currentScore: number;
  attendancePercent: number;
  attendedClasses: number;
  totalClasses: number;
  facultyName: string;
  schedule: string;
  syllabusUnits: string[];
}

export type AssignmentStatus = 'Pending' | 'Completed' | 'Overdue';

export interface Assignment {
  id: string;
  title: string;
  courseCode: string;
  weightPercent: number;
  description: string;
  dueDate: string;
  status: AssignmentStatus;
  submissionDate?: string;
  obtainedMarks?: number;
  maxMarks: number;
  feedback?: string;
  submittedFileName?: string;
}

export type LectureEventType = 'Lecture' | 'Lab' | 'Discussion' | 'Exam' | 'Tutorial';

export interface LectureEvent {
  id: string;
  courseCode: string;
  courseName: string;
  type: LectureEventType;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 to 6
  startTime: string;
  endTime: string;
  location: string;
  unitTopic: string;
  facultyName: string;
  notesAvailable: boolean;
  notesTitle?: string;
}

export interface DoubtReply {
  id: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
  isFacultyResponse: boolean;
}

export interface DoubtQuestion {
  id: string;
  title: string;
  courseCode: string;
  details: string;
  postedBy: string;
  authorRole: UserRole;
  date: string;
  status: 'Answered' | 'Pending';
  replies: DoubtReply[];
}

export interface PyqTopicSuggestion {
  topic: string;
  score: number;
  confidence: number;
  frequency: number;
  avgMarks: number;
  unitId: string;
  unitName: string;
  representativeQuestions: Array<{
    id: string;
    marks: number;
    year: number;
    text: string;
  }>;
}

export interface AcademicAnnouncement {
  id: string;
  title: string;
  date: string;
  author: string;
  content: string;
  category: 'Examination' | 'Registration' | 'Department';
}

export interface DomainRecord {
  domain: string;
  status: 'active' | 'pending_verification' | 'failed';
  recordType: 'CNAME' | 'A' | 'TXT';
  host: string;
  target: string;
  sslActive: boolean;
  connectedAt: string;
}

export interface SemesterRecord {
  semester: number;
  name: string;
  sgpa: number;
  cgpa: number;
  credits: number;
  year: string;
  isCurrent?: boolean;
}

export interface AssignmentPerformanceRecord {
  id: string;
  title: string;
  courseCode: string;
  date: string;
  scorePercent: number;
  classAveragePercent: number;
  maxMarks: number;
  weight: number;
  status: 'Graded' | 'Estimated';
}

export type StudyPriority = 'Critical' | 'High' | 'Medium' | 'Review';

export interface StudySessionItem {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  durationMinutes: number;
  timeBlock: string;
  priority: StudyPriority;
  category: 'assignment' | 'lecture_prep' | 'concept_review' | 'practice_drill';
  rationale: string;
  actionItems: string[];
  recommendedTechnique: string;
  relatedAssignmentId?: string;
  relatedLectureTopic?: string;
  completed: boolean;
}

export interface DailyStudyPlan {
  id: string;
  date: string;
  targetHours: number;
  strategy: 'deadlines' | 'balanced' | 'mastery';
  sessions: StudySessionItem[];
  summaryInsight: string;
  aiCoachingTip?: string;
}
