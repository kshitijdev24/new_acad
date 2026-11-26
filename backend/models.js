import mongoose from 'mongoose';

// User Schema
const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['student', 'faculty', 'advisor', 'admin'], default: 'student' },
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    passwordHash: { type: String, select: false },
    notificationPreferences: {
      assignments: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
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
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true },
    credits: { type: Number, required: true },
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    capacity: { type: Number, min: 0, default: 70 },
    status: { type: String, enum: ['active', 'inactive', 'archived', 'upcoming'], default: 'active' },
    session: { type: String, trim: true, default: '2026-27' },
    semester: { type: Number, min: 1, max: 12, default: 1 },
    currentGrade: { type: String, default: 'A-' },
    currentScore: { type: Number, default: 85 },
    gradingType: { type: String, enum: ['letter', 'passFail', 'audit'], default: 'letter' },
    facultyUserId: { type: String, default: '' },
    attendancePercent: { type: Number, default: 88.0 },
    attendedClasses: { type: Number, default: 22 },
    totalClasses: { type: Number, default: 25 },
    facultyName: { type: String, default: 'Unassigned' },
    schedule: { type: String, default: '' },
    syllabusUnits: [{ type: String }],
  },
  { timestamps: true }
);
CourseSchema.index({ institutionId: 1, departmentId: 1, code: 1 });
CourseSchema.index({ institutionId: 1, departmentId: 1, code: 1, session: 1 }, { unique: true, partialFilterExpression: { institutionId: { $exists: true }, departmentId: { $exists: true } } });

// Assignment Schema
const AssignmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    courseCode: { type: String, required: true },
    weightPercent: { type: Number, required: true },
    description: { type: String, default: '' },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Overdue'],
      default: 'Pending',
    },
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', index: true },
    createdBy: { type: String, index: true },
    source: { type: String, enum: ['faculty', 'personal'], default: 'faculty', index: true },
    ownerStudentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    lifecycleStatus: { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },
    allowLateSubmission: { type: Boolean, default: false },
    latePenaltyPercent: { type: Number, min: 0, max: 100, default: 0 },
    allowedFileTypes: { type: [String], default: () => ['.pdf', '.zip', '.java', '.py', '.docx'] },
    maxFileSizeMB: { type: Number, min: 1, max: 100, default: () => Number(process.env.ASSIGNMENT_MAX_FILE_SIZE_MB) || 20 },
    deletedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: Date.now },
    submissionDate: { type: String },
    obtainedMarks: { type: Number },
    maxMarks: { type: Number, default: 100 },
    feedback: { type: String },
    submittedFileName: { type: String },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
    type: { type: String, trim: true, default: 'assignment' },
    maxScore: { type: Number, min: 0 },
    cohortId: { type: String, trim: true },
  },
  { timestamps: true }
);
AssignmentSchema.index({ courseId: 1, semesterId: 1 });
AssignmentSchema.index({ courseId: 1, dueDate: 1 });
AssignmentSchema.index({ ownerStudentId: 1, dueDate: 1 });

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

const StudentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    programId: { type: String, default: '' },
    enrollmentYear: { type: Number },
    cohortId: { type: String, default: '' },
  },
  { timestamps: true }
);

const SemesterSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    semesterNumber: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true, trim: true },
    status: { type: String, enum: ['completed', 'current'], default: 'completed' },
    credits: { type: Number, min: 0, default: 0 },
    sgpa: { type: Number, min: 0, default: null },
    cgpa: { type: Number, min: 0, default: null },
    gradePoints: [{
      courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
      credits: { type: Number, min: 0 },
      gradePoint: { type: Number, min: 0 },
      gradeStatus: { type: String, enum: ['graded', 'incomplete', 'withdrawn'], default: 'graded' },
      attempt: { type: Number, min: 1, default: 1 },
    }],
  },
  { timestamps: true }
);
SemesterSchema.index({ studentId: 1, semesterNumber: 1 }, { unique: true });

const CourseEnrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    credits: { type: Number, required: true, min: 0 },
    grade: { type: String, default: '' },
    gradePoint: { type: Number, required: true, min: 0 },
    gradeStatus: { type: String, enum: ['graded', 'incomplete', 'withdrawn'], default: 'graded' },
    attempt: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true }
);
CourseEnrollmentSchema.index({ studentId: 1, semesterId: 1, courseId: 1, attempt: 1 }, { unique: true });
CourseEnrollmentSchema.index({ courseId: 1, semesterId: 1 });

const GradingScaleSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', default: null, index: true },
    programId: { type: String, trim: true, default: 'default', index: true },
    name: { type: String, required: true, trim: true },
    maxPoints: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    grades: [{
      letter: { type: String, required: true, trim: true },
      points: { type: Number, required: true, min: 0 },
      minPercent: { type: Number, required: true, min: 0, max: 100 },
      maxPercent: { type: Number, min: 0, max: 100 },
      isPassing: { type: Boolean, default: true },
    }],
    rounding: {
      sgpaDecimals: { type: Number, min: 0, max: 4, default: 2 },
      mode: { type: String, enum: ['half-up'], default: 'half-up' },
    },
    selectableGrades: [{ type: String, trim: true }],
    minTarget: { type: Number, min: 0, default: 2 },
    maxTarget: { type: Number, min: 0, required: true },
    step: { type: Number, min: 0.001, default: 0.05 },
    attendanceThresholdPercent: { type: Number, min: 0, max: 100, default: 75 },
    repeatPolicy: { type: String, enum: ['latest', 'best', 'all'], default: 'latest' },
    excludePassFail: { type: Boolean, default: true },
    excludeAudit: { type: Boolean, default: true },
    excludeWithdrawn: { type: Boolean, default: true },
  },
  { timestamps: true }
);
GradingScaleSchema.index({ programId: 1, institutionId: 1, effectiveFrom: -1 });

const CourseEvaluationSchemeSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', default: null },
    components: [{
      name: { type: String, required: true, trim: true },
      type: { type: String, trim: true, default: 'assessment' },
      weightPercent: { type: Number, required: true, min: 0, max: 100 },
      maxMarks: { type: Number, required: true, min: 0.01 },
      assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', default: null },
    }],
  },
  {
    timestamps: true,
    validateBeforeSave: true,
  }
);
CourseEvaluationSchemeSchema.path('components').validate(
  (components) => components.length > 0
    && Math.abs(components.reduce((sum, component) => sum + Number(component.weightPercent || 0), 0) - 100) < 0.01,
  'Evaluation component weights must total 100%.'
);
CourseEvaluationSchemeSchema.index({ courseId: 1, semesterId: 1 });

const ComponentScoreSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    componentName: { type: String, required: true, trim: true },
    obtainedMarks: { type: Number, min: 0, required: true },
    maxMarks: { type: Number, min: 0.01, required: true },
    status: { type: String, enum: ['graded', 'pending'], default: 'pending' },
  },
  { timestamps: true }
);
ComponentScoreSchema.index(
  { courseId: 1, studentId: 1, semesterId: 1, componentName: 1 },
  { unique: true }
);

const CourseResultSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    letterGrade: { type: String, required: true, trim: true },
    gradePoints: { type: Number, required: true, min: 0 },
    isFinal: { type: Boolean, default: true },
    repeatOf: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseResult', default: null },
    attempt: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true }
);
CourseResultSchema.index({ studentId: 1, semesterId: 1 });
CourseResultSchema.index({ studentId: 1, courseId: 1, semesterId: 1, attempt: 1 }, { unique: true });

const GpaScenarioSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    semesterId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    predictedGrades: { type: Map, of: String, default: () => new Map() },
    targetGpa: { type: Number, default: null },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);
GpaScenarioSchema.index({ userId: 1, createdAt: -1 });

const SubmissionSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    score: { type: Number, min: 0, default: null },
    scorePercent: { type: Number, min: 0, max: 100, default: null },
    submittedAt: { type: Date, default: null },
    isLate: { type: Boolean, default: false },
    files: [{
      originalName: { type: String, required: true },
      storageKey: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, min: 0, required: true },
      sha256: { type: String, required: true },
    }],
    note: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'submitted', 'graded', 'late', 'returned', 'withdrawn'], default: 'pending' },
    gradedAt: { type: Date, default: null },
    submittedOnTime: { type: Boolean, default: null },
    obtainedMarks: { type: Number, min: 0, max: 200, default: null },
    feedback: { type: String, default: '' },
    gradedBy: { type: String, default: '' },
    version: { type: Number, min: 1, default: 0 },
    history: { type: [mongoose.Schema.Types.Mixed], default: [] },
    withdrawnAt: { type: Date, default: null },
  },
  { timestamps: true }
);
SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
SubmissionSchema.index({ studentId: 1, status: 1 });
SubmissionSchema.index({ studentId: 1, submittedAt: -1 });
SubmissionSchema.post('save', async (submission) => {
  const { handleSubmissionChange } = await import('./services/performanceService.js');
  await handleSubmissionChange(submission);
});

const AssignmentStatsSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, unique: true },
    classAveragePercent: { type: Number, default: null },
    medianPercent: { type: Number, default: null },
    stdDev: { type: Number, default: null },
    submissionCount: { type: Number, min: 0, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const AcademicSettingsSchema = new mongoose.Schema(
  {
    programId: { type: String, required: true, default: 'default' },
    distinctionThreshold: { type: Number, min: 0, default: 3.5 },
    distinctionLabel: { type: String, trim: true, default: "Dean's Honor Roll" },
    benchmarkPercent: { type: Number, min: 0, max: 100, default: 80 },
    privacyThreshold: { type: Number, min: 1, default: () => Number(process.env.PERFORMANCE_PRIVACY_THRESHOLD) || 5 },
    gpaScale: { type: Number, min: 1, default: 4 },
    repeatPolicy: { type: String, enum: ['latest', 'all'], default: 'latest' },
    withdrawalPolicy: { type: String, enum: ['exclude', 'include'], default: 'exclude' },
    incompletePolicy: { type: String, enum: ['exclude', 'include'], default: 'exclude' },
    excludeOwnScore: { type: Boolean, default: false },
  },
  { timestamps: true }
);
AcademicSettingsSchema.index({ programId: 1 }, { unique: true });

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

const UniversitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true, uppercase: true },
  },
  { timestamps: true }
);
UniversitySchema.index({ name: 1, shortName: 1 }, { unique: true });

const InstitutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true, uppercase: true },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    universityId: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
    accreditations: [{ type: String, trim: true }],
    nirfBand: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
InstitutionSchema.index({ name: 1 }, { unique: true });

const DepartmentSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);
DepartmentSchema.index({ institutionId: 1, code: 1 }, { unique: true });

const CustomDomainSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    domain: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ['active', 'pending_verification', 'verifying', 'failed', 'disabled'], default: 'pending_verification' },
    recordType: { type: String, enum: ['CNAME'], default: 'CNAME' },
    target: { type: String, required: true, lowercase: true, trim: true },
    verificationToken: { type: String, required: true, select: false },
    verificationType: { type: String, enum: ['TXT'], default: 'TXT' },
    verifiedAt: { type: Date, default: null },
    ssl: {
      status: { type: String, enum: ['active', 'provisioning', 'failed', 'none'], default: 'none' },
      issuer: { type: String, default: '' },
      expiresAt: { type: Date, default: null },
      protocol: { type: String, default: '' },
      autoRenew: { type: Boolean, default: false },
      lastRenewedAt: { type: Date, default: null },
    },
    providerCertificateId: { type: String, select: false },
    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    consecutiveDnsFailures: { type: Number, default: 0 },
    failureNotifiedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);
CustomDomainSchema.index(
  { domain: 1 },
  { unique: true, partialFilterExpression: { releasedAt: { $exists: false } } }
);

const CourseFacultySchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['primary', 'co-instructor'], required: true },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: String, required: true },
    active: { type: Boolean, default: true },
    removedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
CourseFacultySchema.index(
  { courseId: 1, facultyId: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

const EnrollmentSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    studentId: { type: String, required: true, trim: true },
    status: { type: String, enum: ['enrolled', 'dropped', 'completed'], default: 'enrolled' },
    enrolledAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
EnrollmentSchema.index({ courseId: 1, status: 1 });
EnrollmentSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

const StudentAssignmentStateSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    manualCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
StudentAssignmentStateSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
StudentAssignmentStateSchema.index({ studentId: 1, completedAt: 1 });

const ReminderSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    type: { type: String, enum: ['24h', '1h', 'overdue'], required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
ReminderSchema.index({ assignmentId: 1, studentId: 1, type: 1 }, { unique: true });
ReminderSchema.index({ studentId: 1, sentAt: -1 });

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 1000 },
    category: { type: String, enum: ['assignment', 'reminder', 'grade'], default: 'assignment' },
    relatedAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);
NotificationSchema.index({ userId: 1, createdAt: -1 });

const AuditLogSchema = new mongoose.Schema(
  {
    institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
AuditLogSchema.index({ institutionId: 1, createdAt: -1 });

const SubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    userId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);
SubjectSchema.index({ userId: 1, code: 1 }, { unique: true });

const UnitSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    order: { type: Number, required: true, min: 1 },
    syllabusWeight: { type: Number, min: 0, max: 1, default: 1 },
  },
  { timestamps: true }
);
UnitSchema.index({ subjectId: 1, order: 1 }, { unique: true });

const TopicSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    name: { type: String, required: true, trim: true, maxlength: 240 },
    keywords: [{ type: String, trim: true, maxlength: 100 }],
    embedding: { type: [Number], default: [], select: false },
    syllabusWeight: { type: Number, min: 0, max: 1, default: 1 },
  },
  { timestamps: true }
);
TopicSchema.index({ subjectId: 1, unitId: 1, name: 1 }, { unique: true });

const PyqPaperSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    examName: { type: String, required: true, trim: true, maxlength: 160 },
    year: { type: Number, required: true, min: 1900, max: 2200 },
    session: { type: String, trim: true, maxlength: 80, default: '' },
    totalMarks: { type: Number, min: 1, max: 1000 },
    duration: { type: Number, min: 1, max: 1440 },
    fileUrl: { type: String, required: true, select: false },
    fileHash: { type: String, required: true, select: false },
    rawText: { type: String, select: false, default: '' },
    status: {
      type: String,
      enum: ['queued', 'extracting', 'parsing', 'mapping', 'done', 'failed'],
      default: 'queued',
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    failReason: { type: String, maxlength: 1000, default: '' },
    attempts: { type: Number, min: 0, default: 0 },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'PyqJob' },
  },
  { timestamps: true }
);
PyqPaperSchema.index({ subjectId: 1, year: -1 });
PyqPaperSchema.index({ userId: 1, fileHash: 1 }, { unique: true });
PyqPaperSchema.index({ userId: 1, createdAt: -1 });

const QuestionSchema = new mongoose.Schema(
  {
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'PyqPaper', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    year: { type: Number, required: true },
    number: { type: String, required: true, maxlength: 30 },
    subPart: { type: String, maxlength: 20, default: '' },
    section: { type: String, maxlength: 80, default: '' },
    choiceGroupId: { type: String, maxlength: 80, default: '' },
    text: { type: String, required: true, maxlength: 10000 },
    marks: { type: Number, min: 0, max: 1000 },
    type: {
      type: String,
      enum: ['mcq', 'short', 'long', 'numerical', 'case'],
      default: 'long',
    },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null },
    topicIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    mappingConfidence: { type: Number, min: 0, max: 1, default: 0 },
    isUnmapped: { type: Boolean, default: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    embedding: { type: [Number], default: [], select: false },
    duplicateGroupId: { type: String, default: '' },
    userEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);
QuestionSchema.index({ subjectId: 1, topicIds: 1 });
QuestionSchema.index({ paperId: 1, number: 1, subPart: 1 });
QuestionSchema.index({ subjectId: 1, isUnmapped: 1 });
QuestionSchema.index({ duplicateGroupId: 1 });

const TopicStatsSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    frequency: { type: Number, min: 0, default: 0 },
    yearsAppeared: [{ type: Number }],
    totalMarks: { type: Number, min: 0, default: 0 },
    marksPercent: { type: Number, min: 0, max: 100, default: 0 },
    lastYearAppeared: { type: Number, default: null },
    gapYears: { type: Number, min: 0, default: 0 },
    trend: { type: String, enum: ['rising', 'stable', 'falling'], default: 'stable' },
    importanceScore: { type: Number, min: 0, max: 100, default: 0 },
    level: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
    tags: [{ type: String }],
    reason: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true }
);
TopicStatsSchema.index({ subjectId: 1, topicId: 1 }, { unique: true });
TopicStatsSchema.index({ subjectId: 1, importanceScore: -1 });

const UnitStatsSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    frequency: { type: Number, min: 0, default: 0 },
    totalMarks: { type: Number, min: 0, default: 0 },
    marksPercent: { type: Number, min: 0, max: 100, default: 0 },
    importanceScore: { type: Number, min: 0, max: 100, default: 0 },
    level: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
    reason: { type: String, maxlength: 500, default: '' },
  },
  { timestamps: true }
);
UnitStatsSchema.index({ subjectId: 1, unitId: 1 }, { unique: true });

const PyqJobSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: 'PyqPaper', required: true },
    status: {
      type: String,
      enum: ['queued', 'extracting', 'parsing', 'mapping', 'done', 'failed'],
      default: 'queued',
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    attempts: { type: Number, min: 0, default: 0 },
    failReason: { type: String, maxlength: 1000, default: '' },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);
PyqJobSchema.index({ userId: 1, createdAt: -1 });
PyqJobSchema.index({ status: 1, createdAt: 1 });

const ProbablePaperSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    version: { type: Number, required: true, min: 1 },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    totalMarks: { type: Number, required: true, min: 1 },
    duration: { type: Number, required: true, min: 1 },
    sections: [
      {
        title: { type: String, required: true },
        questions: [
          {
            text: { type: String, required: true },
            marks: { type: Number, required: true, min: 1 },
            type: { type: String, enum: ['mcq', 'short', 'long', 'numerical', 'case'] },
            unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
            topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
            probability: { type: Number, min: 0, max: 100 },
            reason: { type: String },
            hint: { type: String },
            answerKey: { type: String },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);
ProbablePaperSchema.index({ subjectId: 1, version: 1 }, { unique: true });
ProbablePaperSchema.index({ userId: 1, createdAt: -1 });

const DailyQuotaSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    day: { type: String, required: true },
    uploads: { type: Number, min: 0, default: 0 },
    llmCalls: { type: Number, min: 0, default: 0 },
    embeddingCalls: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);
DailyQuotaSchema.index({ userId: 1, day: 1 }, { unique: true });

const EmbeddingCacheSchema = new mongoose.Schema(
  {
    contentHash: { type: String, required: true },
    model: { type: String, required: true },
    values: { type: [Number], required: true, select: false },
  },
  { timestamps: true }
);
EmbeddingCacheSchema.index({ contentHash: 1, model: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Course = mongoose.models.Course || mongoose.model('Course', CourseSchema);
export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
export const LectureEvent = mongoose.models.LectureEvent || mongoose.model('LectureEvent', LectureEventSchema);
export const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema);
export const DoubtQuestion = mongoose.models.DoubtQuestion || mongoose.model('DoubtQuestion', DoubtQuestionSchema);
export const SemesterRecord = mongoose.models.SemesterRecord || mongoose.model('SemesterRecord', SemesterRecordSchema);
export const Student = mongoose.models.Student || mongoose.model('Student', StudentSchema);
export const Semester = mongoose.models.Semester || mongoose.model('Semester', SemesterSchema);
export const CourseEnrollment = mongoose.models.CourseEnrollment || mongoose.model('CourseEnrollment', CourseEnrollmentSchema);
export const GradingScale = mongoose.models.GradingScale || mongoose.model('GradingScale', GradingScaleSchema);
export const CourseEvaluationScheme = mongoose.models.CourseEvaluationScheme || mongoose.model('CourseEvaluationScheme', CourseEvaluationSchemeSchema);
export const ComponentScore = mongoose.models.ComponentScore || mongoose.model('ComponentScore', ComponentScoreSchema);
export const CourseResult = mongoose.models.CourseResult || mongoose.model('CourseResult', CourseResultSchema);
export const GpaScenario = mongoose.models.GpaScenario || mongoose.model('GpaScenario', GpaScenarioSchema);
export const Submission = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
export const AssignmentStats = mongoose.models.AssignmentStats || mongoose.model('AssignmentStats', AssignmentStatsSchema);
export const AcademicSettings = mongoose.models.AcademicSettings || mongoose.model('AcademicSettings', AcademicSettingsSchema);
export const DomainRecord = mongoose.models.DomainRecord || mongoose.model('DomainRecord', DomainRecordSchema);
export const University = mongoose.models.University || mongoose.model('University', UniversitySchema);
export const Institution = mongoose.models.Institution || mongoose.model('Institution', InstitutionSchema);
export const Department = mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
export const CustomDomain = mongoose.models.CustomDomain || mongoose.model('CustomDomain', CustomDomainSchema);
export const CourseFaculty = mongoose.models.CourseFaculty || mongoose.model('CourseFaculty', CourseFacultySchema);
export const Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', EnrollmentSchema);
export const StudentAssignmentState = mongoose.models.StudentAssignmentState || mongoose.model('StudentAssignmentState', StudentAssignmentStateSchema);
export const Reminder = mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema);
export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
export const Unit = mongoose.models.Unit || mongoose.model('Unit', UnitSchema);
export const Topic = mongoose.models.Topic || mongoose.model('Topic', TopicSchema);
export const PyqPaper = mongoose.models.PyqPaper || mongoose.model('PyqPaper', PyqPaperSchema);
export const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
export const TopicStats = mongoose.models.TopicStats || mongoose.model('TopicStats', TopicStatsSchema);
export const UnitStats = mongoose.models.UnitStats || mongoose.model('UnitStats', UnitStatsSchema);
export const PyqJob = mongoose.models.PyqJob || mongoose.model('PyqJob', PyqJobSchema);
export const ProbablePaper = mongoose.models.ProbablePaper || mongoose.model('ProbablePaper', ProbablePaperSchema);
export const DailyQuota = mongoose.models.DailyQuota || mongoose.model('DailyQuota', DailyQuotaSchema);
export const EmbeddingCache = mongoose.models.EmbeddingCache || mongoose.model('EmbeddingCache', EmbeddingCacheSchema);
