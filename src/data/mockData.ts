import {
  UserProfile,
  Course,
  Assignment,
  LectureEvent,
  DoubtQuestion,
  PyqTopicSuggestion,
  AcademicAnnouncement,
  DomainRecord
} from '../types/academic';

export const GRADE_POINTS: Record<string, number> = {
  'A': 4.0,
  'A-': 3.7,
  'B+': 3.3,
  'B': 3.0,
  'B-': 2.7,
  'C+': 2.3,
  'C': 2.0,
  'F': 0.0,
};

export const INITIAL_STUDENT_USER: UserProfile = {
  id: 'usr-student-01',
  name: 'Kshitij Jaiswal',
  email: 'kshitij.chetan030174@gmail.com',
  role: 'student',
  enrollmentNumber: '09511502722',
  department: 'Computer Science and Engineering',
  semester: 5,
  institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
  avatarInitials: 'KJ',
};

export const INITIAL_FACULTY_USER: UserProfile = {
  id: 'usr-faculty-01',
  name: 'Ms. Deepika Yadav',
  email: 'deepika.yadav@bvcoe.edu.in',
  role: 'faculty',
  department: 'Computer Science and Engineering',
  semester: 5,
  institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
  avatarInitials: 'DY',
};

export const INITIAL_ADMIN_USER: UserProfile = {
  id: 'usr-admin-01',
  name: 'Dr. Deepika Kumar',
  email: 'hod.cse@bvcoe.edu.in',
  role: 'admin',
  department: 'Computer Science and Engineering',
  semester: 5,
  institution: "Bharati Vidyapeeth's College of Engineering, New Delhi",
  avatarInitials: 'DK',
};

export const INITIAL_COURSES: Course[] = [
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
      'Unit 4: Algorithm Complexity and Sorting'
    ]
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
      'Unit 4: Sequences and Series Convergence'
    ]
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
      'Unit 4: Semiconductor Physics and Transistors'
    ]
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
      'Unit 4: Peer Review and Academic Integrity'
    ]
  }
];

// Calculate an urgent deliverable deadline in ~16 hours from current runtime
const getUpcomingDeadlineWithin24Hours = () => {
  const d = new Date(Date.now() + 16 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const INITIAL_ASSIGNMENTS: Assignment[] = [
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
    submittedFileName: 'phys101_lab_report_2_kshitij.pdf'
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
  }
];

export const INITIAL_ANNOUNCEMENTS: AcademicAnnouncement[] = [
  {
    id: 'ann-01',
    title: 'Final Examination Schedule Published',
    date: '2026-09-30',
    author: 'Examination Controller, BVCOE',
    content: 'The end-term theory and laboratory practical schedules for Semester 5 (Odd 2026) are uploaded to the academic repository. Review room allocations and report clashes within 48 hours.',
    category: 'Examination'
  },
  {
    id: 'ann-02',
    title: 'Summer Internship and Elective Registration Open',
    date: '2026-09-28',
    author: 'Academic Cell',
    content: 'Department of Computer Science has opened registration for Department Elective III and Summer Training certificate submissions.',
    category: 'Registration'
  },
  {
    id: 'ann-03',
    title: 'Internal Assessment Marks Verification',
    date: '2026-09-25',
    author: 'Ms. Deepika Yadav (Faculty Coordinator)',
    content: 'Midterm test marks for CS101 and lab assessments are synchronized. Check your respective dashboard rows and verify marks before Friday.',
    category: 'Department'
  }
];

export const INITIAL_LECTURE_EVENTS: LectureEvent[] = [
  {
    id: 'lec-01',
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    type: 'Lecture',
    date: '2026-10-12',
    dayOfWeek: 1, // Monday
    startTime: '10:00 AM',
    endTime: '11:30 AM',
    location: 'Hall A-101',
    unitTopic: 'Unit 3: Self-balancing BSTs and AVL Rotations',
    facultyName: 'Ms. Deepika Yadav',
    notesAvailable: true,
    notesTitle: 'CS101_Lecture14_BST_Balancing.pdf'
  },
  {
    id: 'lec-02',
    courseCode: 'MATH201',
    courseName: 'Calculus I',
    type: 'Lecture',
    date: '2026-10-12',
    dayOfWeek: 1, // Monday
    startTime: '1:00 PM',
    endTime: '2:30 PM',
    location: 'Hall B-205',
    unitTopic: 'Unit 3: Integration by Parts and Tabular Method',
    facultyName: 'Dr. R. K. Sharma',
    notesAvailable: true,
    notesTitle: 'MATH201_IntegrationByParts_Handout.pdf'
  },
  {
    id: 'lec-03',
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    type: 'Lab',
    date: '2026-10-13',
    dayOfWeek: 2, // Tuesday
    startTime: '2:00 PM',
    endTime: '4:00 PM',
    location: 'Computer Lab 3',
    unitTopic: 'Hands-on Java: Implementing Binary Search Trees',
    facultyName: 'Ms. Deepika Yadav',
    notesAvailable: true,
    notesTitle: 'LabExercise_BST_Skeleton.java'
  },
  {
    id: 'lec-04',
    courseCode: 'PHYS101',
    courseName: 'Physics for Engineers',
    type: 'Lecture',
    date: '2026-10-14',
    dayOfWeek: 3, // Wednesday
    startTime: '9:00 AM',
    endTime: '10:30 AM',
    location: 'Hall A-102',
    unitTopic: 'Unit 2: Maxwell Equations and Displacement Current',
    facultyName: 'Dr. Neha Gupta',
    notesAvailable: true,
    notesTitle: 'PHYS101_Electrodynamics_Slides.pdf'
  },
  {
    id: 'lec-05',
    courseCode: 'ENG101',
    courseName: 'Academic Writing',
    type: 'Discussion',
    date: '2026-10-14',
    dayOfWeek: 3, // Wednesday
    startTime: '3:00 PM',
    endTime: '4:00 PM',
    location: 'Room C-110',
    unitTopic: 'Unit 3: Peer Review of Working Paper Outlines',
    facultyName: 'Prof. S. Mukherjee',
    notesAvailable: false
  },
  {
    id: 'lec-06',
    courseCode: 'CS101',
    courseName: 'Introduction to Computer Science',
    type: 'Exam',
    date: '2026-10-15',
    dayOfWeek: 4, // Thursday
    startTime: '10:00 AM',
    endTime: '12:00 PM',
    location: 'Examination Hall',
    unitTopic: 'Midterm Assessment: Units 1, 2, and 3 Theory',
    facultyName: 'Department Exam Board',
    notesAvailable: true,
    notesTitle: 'CS101_Midterm_Syllabus_Breakdown.pdf'
  },
  {
    id: 'lec-07',
    courseCode: 'MATH201',
    courseName: 'Calculus I',
    type: 'Tutorial',
    date: '2026-10-15',
    dayOfWeek: 4, // Thursday
    startTime: '2:00 PM',
    endTime: '3:00 PM',
    location: 'Room B-210',
    unitTopic: 'Problem Solving Workshop: Improper Integrals',
    facultyName: 'Dr. R. K. Sharma',
    notesAvailable: true,
    notesTitle: 'MATH201_TutorialSheet_4.pdf'
  },
  {
    id: 'lec-08',
    courseCode: 'PHYS101',
    courseName: 'Physics for Engineers',
    type: 'Lab',
    date: '2026-10-16',
    dayOfWeek: 5, // Friday
    startTime: '1:00 PM',
    endTime: '3:00 PM',
    location: 'Physics Lab 2',
    unitTopic: 'Experiment 6: Newton Rings and Wavelength Measurement',
    facultyName: 'Dr. Neha Gupta',
    notesAvailable: true,
    notesTitle: 'PHYS101_NewtonRings_Manual.pdf'
  }
];

export const INITIAL_DOUBT_QUESTIONS: DoubtQuestion[] = [
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
        isFacultyResponse: true
      },
      {
        id: 'rep-02',
        authorName: 'Kshitij Jaiswal',
        authorRole: 'student',
        text: 'Thank you maam. That resolved the pointer issue. Implementing findMin(root.right) properly preserved the tree invariant.',
        createdAt: '2026-10-05 16:05',
        isFacultyResponse: false
      }
    ]
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
    replies: [
      {
        id: 'rep-03',
        authorName: 'Dr. R. K. Sharma',
        authorRole: 'faculty',
        text: 'The LIATE rule (Logarithmic, Inverse trig, Algebraic, Trig, Exponential) provides a priority order for u. Here x is Algebraic and e^(2x) is Exponential, so assign u = x (du = dx) and dv = e^(2x) dx (v = 0.5 * e^(2x)). We will review circular integrals in Thursday tutorial.',
        createdAt: '2026-10-08 11:30',
        isFacultyResponse: true
      }
    ]
  },
  {
    id: 'dbt-03',
    title: 'Error in physics lab calculation',
    courseCode: 'PHYS101',
    details: 'For Lab 5 (compound pendulum), my calculated value of g is 10.42 m/s^2, which has a 6.2% error against local Delhi gravity 9.79 m/s^2. Is it caused by neglecting knife-edge friction or radius of gyration correction?',
    postedBy: 'Michael Johnson',
    authorRole: 'student',
    date: '2026-10-10',
    status: 'Answered',
    replies: [
      {
        id: 'rep-04',
        authorName: 'Dr. Neha Gupta',
        authorRole: 'faculty',
        text: 'The primary source of error in Lab 5 is usually the timing gate parallax and failing to account for the finite radius of the cylindrical brass weights. Re-run your spreadsheet using the Steiner parallel axis theorem offset.',
        createdAt: '2026-10-10 15:45',
        isFacultyResponse: true
      }
    ]
  }
];

export const INITIAL_PYQ_TOPICS: PyqTopicSuggestion[] = [
  {
    topic: 'Dynamic Programming (Knapsack & Optimal Substructure)',
    score: 9.4,
    confidence: 0.92,
    frequency: 14,
    avgMarks: 10,
    unitId: 'U3',
    unitName: 'Data Structures and Algorithms',
    representativeQuestions: [
      { id: 'PYQ-2024-Q5', marks: 10, year: 2024, text: 'Formulate the 0/1 Knapsack recurrence relation and compute the optimal value table for W=8.' },
      { id: 'PYQ-2023-Q4', marks: 10, year: 2023, text: 'Prove the optimal substructure property of Longest Common Subsequence (LCS).' }
    ]
  },
  {
    topic: 'Greedy Methods (Huffman Coding & MST Kruskal)',
    score: 8.1,
    confidence: 0.88,
    frequency: 11,
    avgMarks: 8,
    unitId: 'U3',
    unitName: 'Data Structures and Algorithms',
    representativeQuestions: [
      { id: 'PYQ-2024-Q3', marks: 8, year: 2024, text: 'Construct the optimal Huffman tree for given symbol frequencies and calculate weighted path length.' },
      { id: 'PYQ-2022-Q6', marks: 8, year: 2022, text: 'Execute Kruskals minimum spanning tree algorithm with disjoint-set cycle detection.' }
    ]
  },
  {
    topic: 'Recurrence Relations and Master Theorem',
    score: 7.6,
    confidence: 0.85,
    frequency: 9,
    avgMarks: 6,
    unitId: 'U1',
    unitName: 'Computational Foundations',
    representativeQuestions: [
      { id: 'PYQ-2023-Q1', marks: 6, year: 2023, text: 'State all three cases of the Master Theorem and evaluate T(n) = 4T(n/2) + n^2.' }
    ]
  },
  {
    topic: 'Fourier Series and Harmonic Integrals',
    score: 8.8,
    confidence: 0.90,
    frequency: 12,
    avgMarks: 10,
    unitId: 'U2',
    unitName: 'Engineering Mathematics',
    representativeQuestions: [
      { id: 'PYQ-2024-M2', marks: 10, year: 2024, text: 'Expand f(x) = x^2 in a Fourier series over (-pi, pi) and deduce Euler sum of reciprocals.' }
    ]
  },
  {
    topic: 'Maxwell Equations in Differential and Integral Form',
    score: 7.9,
    confidence: 0.84,
    frequency: 8,
    avgMarks: 8,
    unitId: 'U2',
    unitName: 'Physics for Engineers',
    representativeQuestions: [
      { id: 'PYQ-2023-P3', marks: 8, year: 2023, text: 'Derive the wave equation for electric field from Maxwell curl relations in free space.' }
    ]
  }
];

export const INITIAL_DOMAIN_RECORD: DomainRecord = {
  domain: 'portal.acadlytic.bvcoe.edu.in',
  status: 'active',
  recordType: 'CNAME',
  host: 'portal',
  target: 'cname.acadlytic-system.net',
  sslActive: true,
  connectedAt: '2026-08-15 09:00:00 UTC'
};
