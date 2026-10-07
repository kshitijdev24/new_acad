import mongoose from 'mongoose';
import * as models from './models.js';

// Initial seed data
const SEED_USERS = [
  {
    id: 'usr-student-01',
    name: 'Kshitij Jaiswal',
    email: 'kshitij.chetan030174@gmail.com',
    role: 'student',
    enrollmentNumber: '09511502722',
    department: 'Computer Science and Engineering',
    semester: 5,
    institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
    avatarInitials: 'KJ',
  },
  {
    id: 'usr-faculty-01',
    name: 'Ms. Deepika Yadav',
    email: 'deepika.yadav@bvcoe.edu.in',
    role: 'faculty',
    department: 'Computer Science and Engineering',
    semester: 5,
    institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
    avatarInitials: 'DY',
  },
  {
    id: 'usr-admin-01',
    name: 'Dr. Deepika Kumar',
    email: 'hod.cse@bvcoe.edu.in',
    role: 'admin',
    department: 'Computer Science and Engineering',
    semester: 5,
    institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
    avatarInitials: 'DK',
  },
];

const SEED_COURSES = [
  {
    code: 'CS101',
    name: 'Introduction to Computer Science',
    credits: 3,
    currentGrade: 'A-',
    currentScore: 88,
    attendancePercent: 92.0,
    attendedClasses: 23,
    totalClasses: 25,
    facultyName: 'Ms. Deepika Yadav',
    schedule: 'Mon / Wed 10:00 AM - 11:30 AM',
    syllabusUnits: [
      'Unit 1: Computational Foundations and Logic',
      'Unit 2: Object-Oriented Structures and Recursion',
      'Unit 3: Data Structures and Search Trees',
      'Unit 4: Algorithm Complexity and Sorting',
    ],
  },
  {
    code: 'MATH201',
    name: 'Calculus I',
    credits: 4,
    currentGrade: 'B+',
    currentScore: 84,
    attendancePercent: 85.0,
    attendedClasses: 34,
    totalClasses: 40,
    facultyName: 'Dr. R. K. Sharma',
    schedule: 'Mon / Thu 1:00 PM - 2:30 PM',
    syllabusUnits: [
      'Unit 1: Limits and Continuity',
      'Unit 2: Differential Calculus and Mean Value',
      'Unit 3: Integration Techniques and By Parts',
      'Unit 4: Sequences and Series Convergence',
    ],
  },
  {
    code: 'PHYS101',
    name: 'Physics for Engineers',
    credits: 4,
    currentGrade: 'A',
    currentScore: 92,
    attendancePercent: 90.0,
    attendedClasses: 36,
    totalClasses: 40,
    facultyName: 'Dr. Neha Gupta',
    schedule: 'Wed / Fri 9:00 AM - 10:30 AM',
    syllabusUnits: [
      'Unit 1: Wave Optics and Interference',
      'Unit 2: Electromagnetic Theory and Maxwell Laws',
      'Unit 3: Quantum Mechanics Foundations',
      'Unit 4: Semiconductor Physics and Transistors',
    ],
  },
  {
    code: 'ENG101',
    name: 'Academic Writing',
    credits: 3,
    currentGrade: 'B',
    currentScore: 79,
    attendancePercent: 87.0,
    attendedClasses: 20,
    totalClasses: 23,
    facultyName: 'Prof. S. Mukherjee',
    schedule: 'Wed 3:00 PM - 4:00 PM',
    syllabusUnits: [
      'Unit 1: Technical Rhetoric and Citation',
      'Unit 2: Literature Synthesis and Abstracts',
      'Unit 3: Research Paper Drafting',
      'Unit 4: Peer Review and Academic Integrity',
    ],
  },
];

const getUpcomingDeadlineWithin24Hours = () => {
  const d = new Date(Date.now() + 16 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SEED_ASSIGNMENTS = [
  {
    id: 'asg-01',
    title: 'Lab Report 2',
    courseCode: 'PHYS101',
    weightPercent: 10,
    description: 'Write a comprehensive report on the compound pendulum experiment conducted in lab session 5, including error calculation and damping analysis.',
    dueDate: '2026-10-10',
    status: 'Completed',
    submissionDate: '2026-10-09',
    obtainedMarks: 94,
    maxMarks: 100,
    feedback: 'Accurate derivation of damping constants. Clean error bounds.',
    submittedFileName: 'phys101_lab_report_2_kshitij.pdf',
  },
  {
    id: 'asg-02',
    title: 'Calculus Problem Set 4',
    courseCode: 'MATH201',
    weightPercent: 8,
    description: 'Complete problems 15 through 30 in Chapter 5 covering integration by parts, trigonometric substitutions, and improper integrals.',
    dueDate: getUpcomingDeadlineWithin24Hours(),
    status: 'Pending',
    maxMarks: 50,
  },
  {
    id: 'asg-03',
    title: 'Programming Assignment 3',
    courseCode: 'CS101',
    weightPercent: 15,
    description: 'Implement a binary search tree in Java with insertion, deletion, level-order traversal, and balance verification routines.',
    dueDate: '2026-10-15',
    status: 'Pending',
    maxMarks: 100,
  },
  {
    id: 'asg-04',
    title: 'Research Paper Outline',
    courseCode: 'ENG101',
    weightPercent: 5,
    description: 'Create a structured outline for your final technical research paper including thesis statement, literature taxonomy, and IEEE citations.',
    dueDate: '2026-10-20',
    status: 'Pending',
    maxMarks: 25,
  },
];

const SEED_LECTURES = [
  {
    id: 'lec-01',
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    type: 'Lecture',
    date: '2026-10-12',
    dayOfWeek: 1,
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    location: 'Hall A-101',
    unitTopic: 'Unit 3: Self-balancing BSTs and AVL Rotations',
    facultyName: 'Ms. Deepika Yadav',
    notesAvailable: true,
    notesTitle: 'CS101_Lecture14_BST_Balancing.pdf',
  },
  {
    id: 'lec-02',
    courseCode: 'MATH201',
    courseName: 'Calculus I',
    type: 'Lecture',
    date: '2026-10-12',
    dayOfWeek: 1,
    startTime: '1:00 PM',
    endTime: '2:30 PM',
    location: 'Hall B-205',
    unitTopic: 'Unit 3: Integration by Parts and Tabular Method',
    facultyName: 'Dr. R. K. Sharma',
    notesAvailable: true,
    notesTitle: 'MATH201_IntegrationByParts_Handout.pdf',
  },
  {
    id: 'lec-03',
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    type: 'Lab',
    date: '2026-10-13',
    dayOfWeek: 2,
    startTime: '2:00 PM',
    endTime: '4:00 PM',
    location: 'Computer Lab 3',
    unitTopic: 'Hands-on Java: Implementing Binary Search Trees',
    facultyName: 'Ms. Deepika Yadav',
    notesAvailable: true,
    notesTitle: 'LabExercise_BST_Skeleton.java',
  },
  {
    id: 'lec-04',
    courseCode: 'PHYS101',
    courseName: 'Physics for Engineers',
    type: 'Lecture',
    date: '2026-10-14',
    dayOfWeek: 3,
    startTime: '9:00 AM',
    endTime: '10:30 AM',
    location: 'Hall A-102',
    unitTopic: 'Unit 2: Maxwell Equations and Displacement Current',
    facultyName: 'Dr. Neha Gupta',
    notesAvailable: true,
    notesTitle: 'PHYS101_Electrodynamics_Slides.pdf',
  },
  {
    id: 'lec-05',
    courseCode: 'ENG101',
    courseName: 'Academic Writing',
    type: 'Discussion',
    date: '2026-10-14',
    dayOfWeek: 3,
    startTime: '3:00 PM',
    endTime: '4:00 PM',
    location: 'Room C-110',
    unitTopic: 'Unit 3: Peer Review of Working Paper Outlines',
    facultyName: 'Prof. S. Mukherjee',
    notesAvailable: false,
  },
  {
    id: 'lec-06',
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    type: 'Exam',
    date: '2026-10-15',
    dayOfWeek: 4,
    startTime: '10:00 AM',
    endTime: '12:00 PM',
    location: 'Examination Hall',
    unitTopic: 'Midterm Assessment: Units 1, 2, and 3 Theory',
    facultyName: 'Department Exam Board',
    notesAvailable: true,
    notesTitle: 'CS101_Midterm_Syllabus_Breakdown.pdf',
  },
];

const SEED_ANNOUNCEMENTS = [
  {
    id: 'ann-01',
    title: 'Final Examination Schedule Published',
    date: '2026-09-30',
    author: 'Examination Controller, BVCOE',
    content: 'The end-term theory and laboratory practical schedules for Semester 5 (Odd 2026) are uploaded to the academic repository. Review room allocations and report clashes within 48 hours.',
    category: 'Examination',
  },
  {
    id: 'ann-02',
    title: 'Summer Internship and Elective Registration Open',
    date: '2026-09-28',
    author: 'Academic Cell',
    content: 'Department of Computer Science has opened registration for Department Elective III and Summer Training certificate submissions.',
    category: 'Registration',
  },
  {
    id: 'ann-03',
    title: 'Internal Assessment Marks Verification',
    date: '2026-09-25',
    author: 'Ms. Deepika Yadav (Faculty Coordinator)',
    content: 'Midterm test marks for CS101 and lab assessments are synchronized. Check your respective dashboard rows and verify marks before Friday.',
    category: 'Department',
  },
];

const SEED_DOUBTS = [
  {
    id: 'dbt-01',
    title: 'How do I implement a binary search tree in Java?',
    courseCode: 'CS101',
    details: 'I understand the recursive logic for searching, but during deletion of a node with two children, I get a NullPointerException when linking the in-order successor. What is the standard recursive replacement pattern?',
    postedBy: 'John Doe',
    authorRole: 'student',
    date: '2026-10-05',
    status: 'Answered',
    replies: [
      {
        id: 'rep-01',
        authorName: 'Ms. Deepika Yadav',
        authorRole: 'faculty',
        text: 'When deleting a node with two children, locate the smallest value in the right subtree (in-order successor). Copy that value into the current node, then recursively delete that minimum node from the right subtree. Ensure your findMin routine returns the node reference without disconnecting parent pointers prematurely.',
        createdAt: '2026-10-05 14:20',
        isFacultyResponse: true,
      },
      {
        id: 'rep-02',
        authorName: 'Kshitij Jaiswal',
        authorRole: 'student',
        text: 'Thank you maam. That resolved the pointer issue. Implementing findMin(root.right) properly preserved the tree invariant.',
        createdAt: '2026-10-05 16:05',
        isFacultyResponse: false,
      },
    ],
  },
  {
    id: 'dbt-02',
    title: 'Confusion about integration by parts formula',
    courseCode: 'MATH201',
    details: 'In integral x * e^(2x) dx, what criteria dictates choosing u versus dv? Does the LIATE rule guarantee convergence for trigonometric and exponential products?',
    postedBy: 'Emily Brown',
    authorRole: 'student',
    date: '2026-10-08',
    status: 'Pending',
    replies: [],
  },
];

const SEED_PERFORMANCE = [
  { semester: 1, name: 'Sem 1 (Fall 2024)', sgpa: 3.35, cgpa: 3.35, credits: 20, year: '2024-25' },
  { semester: 2, name: 'Sem 2 (Spring 2025)', sgpa: 3.48, cgpa: 3.42, credits: 22, year: '2024-25' },
  { semester: 3, name: 'Sem 3 (Fall 2025)', sgpa: 3.55, cgpa: 3.47, credits: 21, year: '2025-26' },
  { semester: 4, name: 'Sem 4 (Spring 2026)', sgpa: 3.68, cgpa: 3.52, credits: 22, year: '2025-26' },
  { semester: 5, name: 'Sem 5 (Fall 2026 - Current)', sgpa: 3.65, cgpa: 3.55, credits: 14, year: '2026-27', isCurrent: true },
];

const SEED_DOMAIN = {
  domain: 'portal.acadlytic.bvcoe.edu.in',
  status: 'active',
  recordType: 'CNAME',
  host: 'portal',
  target: 'cname.acadlytic-system.net',
  sslActive: true,
  connectedAt: '2026-08-15 09:00:00 UTC',
};

// In-Memory Database store for resilient execution when external MongoDB is not running
class InMemoryStore {
  constructor() {
    this.users = [...SEED_USERS];
    this.courses = [...SEED_COURSES];
    this.assignments = [...SEED_ASSIGNMENTS];
    this.lectures = [...SEED_LECTURES];
    this.announcements = [...SEED_ANNOUNCEMENTS];
    this.doubts = [...SEED_DOUBTS];
    this.performance = [...SEED_PERFORMANCE];
    this.domain = { ...SEED_DOMAIN };
  }

  getUsers() { return this.users; }
  getCourses() { return this.courses; }
  updateCourse(code, updates) {
    const idx = this.courses.findIndex((c) => c.code === code);
    if (idx !== -1) {
      this.courses[idx] = { ...this.courses[idx], ...updates };
      return this.courses[idx];
    }
    return null;
  }

  getAssignments() { return this.assignments; }
  addAssignment(item) {
    const newItem = { ...item, id: item.id || `asg-${Date.now()}` };
    this.assignments.unshift(newItem);
    return newItem;
  }
  updateAssignment(id, updates) {
    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.assignments[idx] = { ...this.assignments[idx], ...updates };
      return this.assignments[idx];
    }
    return null;
  }

  getLectures() { return this.lectures; }
  addLecture(item) {
    const newItem = { ...item, id: item.id || `lec-${Date.now()}` };
    this.lectures.push(newItem);
    return newItem;
  }

  getAnnouncements() { return this.announcements; }

  getDoubts() { return this.doubts; }
  addDoubt(item) {
    const newItem = { ...item, id: item.id || `dbt-${Date.now()}`, replies: [] };
    this.doubts.unshift(newItem);
    return newItem;
  }
  addReply(doubtId, reply) {
    const d = this.doubts.find((q) => q.id === doubtId);
    if (d) {
      d.replies.push({ ...reply, id: `rep-${Date.now()}` });
      if (reply.isFacultyResponse) d.status = 'Answered';
      return d;
    }
    return null;
  }

  getPerformance() { return this.performance; }
  getDomain() { return this.domain; }
  updateDomain(newDomain) {
    this.domain = {
      ...this.domain,
      domain: newDomain,
      status: 'active',
      sslActive: true,
      connectedAt: new Date().toISOString(),
    };
    return this.domain;
  }
}

export const inMemoryDb = new InMemoryStore();
let isMongoConnected = false;

export async function connectMongo() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/acadlytic';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully to', uri);

    // Seed database if empty
    await seedMongoDatabase();
  } catch (err) {
    isMongoConnected = false;
    console.log('[MongoDB] Running with resilient in-memory database storage (MONGODB_URI not reachable).');
  }
}

async function seedMongoDatabase() {
  try {
    const userCount = await models.User.countDocuments();
    if (userCount === 0) {
      await models.User.insertMany(SEED_USERS);
      await models.Course.insertMany(SEED_COURSES);
      await models.Assignment.insertMany(SEED_ASSIGNMENTS);
      await models.LectureEvent.insertMany(SEED_LECTURES);
      await models.Announcement.insertMany(SEED_ANNOUNCEMENTS);
      await models.DoubtQuestion.insertMany(SEED_DOUBTS);
      await models.SemesterRecord.insertMany(SEED_PERFORMANCE);
      await models.DomainRecord.create(SEED_DOMAIN);
      console.log('[MongoDB] Initial institutional collections seeded successfully.');
    }
  } catch (seedErr) {
    console.warn('[MongoDB] Collection seed notice:', seedErr.message);
  }
}

export function getDbStatus() {
  return {
    connected: isMongoConnected,
    mode: isMongoConnected ? 'MongoDB (Mongoose)' : 'In-Memory Resilient DB',
  };
}
