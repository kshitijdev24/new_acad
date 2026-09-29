import mongoose from 'mongoose';

// User Schema
const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
    enrollmentNumber: { type: String },
    department: { type: String, default: 'Computer Science and Engineering' },
    semester: { type: Number, default: 5 },
    institution: {
      type: String,
      default: "Bharati Vidyapeeth's College of Engineering, New Delhi",
    },
    avatarInitials: { type: String, default: 'KJ' },
  },
  { timestamps: true }
);

// Course Schema
const CourseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    currentGrade: { type: String, default: 'A-' },
    currentScore: { type: Number, default: 85 },
    attendancePercent: { type: Number, default: 88.0 },
    attendedClasses: { type: Number, default: 22 },
    totalClasses: { type: Number, default: 25 },
    facultyName: { type: String, required: true },
    schedule: { type: String, required: true },
    syllabusUnits: [{ type: String }],
  },
  { timestamps: true }
);

// Assignment Schema
const AssignmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    courseCode: { type: String, required: true },
    weightPercent: { type: Number, required: true },
    description: { type: String, default: '' },
    dueDate: { type: String, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Overdue'],
      default: 'Pending',
    },
    submissionDate: { type: String },
    obtainedMarks: { type: Number },
    maxMarks: { type: Number, default: 100 },
    feedback: { type: String },
    submittedFileName: { type: String },
  },
  { timestamps: true }
);

// Lecture Event Schema
const LectureEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    courseCode: { type: String, required: true },
    courseName: { type: String, required: true },
    type: {
      type: String,
      enum: ['Lecture', 'Lab', 'Discussion', 'Exam', 'Tutorial'],
      default: 'Lecture',
    },
    date: { type: String, required: true },
    dayOfWeek: { type: Number, default: 1 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: { type: String, required: true },
    unitTopic: { type: String, required: true },
    facultyName: { type: String, required: true },
    notesAvailable: { type: Boolean, default: false },
    notesTitle: { type: String },
  },
  { timestamps: true }
);

// Academic Announcement Schema
const AnnouncementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    date: { type: String, required: true },
    author: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['Examination', 'Registration', 'Department'],
      default: 'Department',
    },
  },
  { timestamps: true }
);

// Doubt Question Schema
const DoubtQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    courseCode: { type: String, required: true },
    details: { type: String, required: true },
    postedBy: { type: String, required: true },
    authorRole: { type: String, enum: ['student', 'faculty', 'admin'], default: 'student' },
    date: { type: String, required: true },
    status: { type: String, enum: ['Answered', 'Pending'], default: 'Pending' },
    replies: [
      {
        id: { type: String, required: true },
        authorName: { type: String, required: true },
        authorRole: { type: String, required: true },
        text: { type: String, required: true },
        createdAt: { type: String, required: true },
        isFacultyResponse: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

// Performance / Semester Record Schema
const SemesterRecordSchema = new mongoose.Schema(
  {
    semester: { type: Number, required: true },
    name: { type: String, required: true },
    sgpa: { type: Number, required: true },
    cgpa: { type: Number, required: true },
    credits: { type: Number, required: true },
    year: { type: String, required: true },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Domain Record Schema
const DomainRecordSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true },
    status: { type: String, default: 'active' },
    recordType: { type: String, default: 'CNAME' },
    host: { type: String, default: 'portal' },
    target: { type: String, default: 'cname.acadlytic-system.net' },
    sslActive: { type: Boolean, default: true },
    connectedAt: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Course = mongoose.models.Course || mongoose.model('Course', CourseSchema);
export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
export const LectureEvent = mongoose.models.LectureEvent || mongoose.model('LectureEvent', LectureEventSchema);
export const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema);
export const DoubtQuestion = mongoose.models.DoubtQuestion || mongoose.model('DoubtQuestion', DoubtQuestionSchema);
export const SemesterRecord = mongoose.models.SemesterRecord || mongoose.model('SemesterRecord', SemesterRecordSchema);
export const DomainRecord = mongoose.models.DomainRecord || mongoose.model('DomainRecord', DomainRecordSchema);
