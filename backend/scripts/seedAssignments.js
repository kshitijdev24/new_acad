import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  Assignment,
  Course,
  CourseEnrollment,
  CourseFaculty,
  Semester,
  Student,
  Submission,
  User,
} from '../models.js';
import { ensureAdminDashboardSeed } from '../services/adminSeedService.js';
import { recomputeAssignmentStats } from '../services/performanceService.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const DEMO_STUDENT_ID = process.env.ASSIGNMENT_DEMO_USER_ID || 'usr-student-01';
const DEMO_FACULTY_ID = process.env.ASSIGNMENT_DEMO_FACULTY_ID || 'usr-faculty-01';
const ASSIGNMENT_FIXTURES = [
  ['CS101', 'Programming Foundations Lab', 10, 7],
  ['CS101', 'Data Structures Practice Set', 15, 14],
  ['CS101', 'Midterm: Algorithms', 20, 21],
  ['MATH201', 'Integration Problem Set', 8, 5],
  ['MATH201', 'Calculus Quiz 2', 10, 12],
  ['MATH201', 'Series and Convergence Portfolio', 15, 18],
  ['PHYS101', 'Pendulum Lab Report', 10, 9],
  ['PHYS101', 'Electromagnetism Assignment', 12, 16],
  ['PHYS101', 'Physics Midterm', 20, 25],
  ['ENG101', 'Research Outline', 5, 6],
  ['ENG101', 'Technical Writing Portfolio', 15, 20],
  ['ENG101', 'Final Presentation', 15, 28],
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding assignments.');
  await mongoose.connect(process.env.MONGODB_URI);
  const { institution, department } = await ensureAdminDashboardSeed();
  const [studentUser, facultyUser] = await Promise.all([
    User.findOneAndUpdate(
      { id: DEMO_STUDENT_ID },
      {
        $setOnInsert: {
          name: 'Demo Student',
          email: 'demo.student@example.invalid',
          role: 'student',
          department: department.name,
        },
        $set: { institutionId: institution._id, departmentId: department._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    User.findOneAndUpdate(
      { id: DEMO_FACULTY_ID },
      {
        $setOnInsert: {
          name: 'Demo Faculty',
          email: 'demo.faculty@example.invalid',
          role: 'faculty',
          department: department.name,
        },
        $set: { institutionId: institution._id, departmentId: department._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]);
  const student = await Student.findOneAndUpdate(
    { userId: studentUser.id },
    { $set: { programId: department.code, enrollmentYear: 2024, cohortId: 'CSE-demo-2024' } },
    { upsert: true, new: true }
  );
  const semester = await Semester.findOneAndUpdate(
    { studentId: student._id, semesterNumber: 5 },
    {
      $set: {
        academicYear: '2026-27',
        status: 'current',
      },
      $setOnInsert: { credits: 0, gradePoints: [] },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const courses = await Course.find({
    institutionId: institution._id,
    departmentId: department._id,
    code: { $in: ['CS101', 'MATH201', 'PHYS101', 'ENG101'] },
  });
  const courseByCode = new Map(courses.map((course) => [course.code, course]));

  for (const course of courses) {
    await CourseFaculty.findOneAndUpdate(
      { courseId: course._id, facultyId: facultyUser._id },
      {
        $set: { role: 'primary', active: true, removedAt: null },
        $setOnInsert: { assignedBy: 'system:assignment-seed' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await CourseEnrollment.findOneAndUpdate(
      { studentId: student._id, semesterId: semester._id, courseId: course._id, attempt: 1 },
      {
        $set: {
          credits: course.credits,
          grade: '',
          gradePoint: 0,
          gradeStatus: 'incomplete',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  const seededAssignments = [];
  for (const [index, [courseCode, title, weightPercent, dueInDays]] of ASSIGNMENT_FIXTURES.entries()) {
    const course = courseByCode.get(courseCode);
    if (!course) throw new Error(`The assignment seed requires course ${courseCode}.`);
    const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
    const assignment = await Assignment.findOneAndUpdate(
      { id: `seed-asg-${String(index + 1).padStart(2, '0')}` },
      {
        $set: {
          title,
          courseCode,
          courseId: course._id,
          semesterId: semester._id,
          institutionId: institution._id,
          createdBy: facultyUser.id,
          source: 'faculty',
          lifecycleStatus: 'published',
          deletedAt: null,
          dueDate,
          weightPercent,
          maxMarks: 100,
          maxScore: 100,
          description: `${title} for ${course.name}.`,
          allowLateSubmission: true,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    seededAssignments.push(assignment);
  }

  await Submission.findOneAndUpdate(
    { assignmentId: seededAssignments[0]._id, studentId: student._id },
    {
      $set: {
        score: 94,
        scorePercent: 94,
        obtainedMarks: 94,
        status: 'graded',
        submittedAt: new Date(),
        submittedOnTime: true,
        isLate: false,
        gradedAt: new Date(),
        feedback: 'Clear solution and accurate analysis.',
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  await Submission.findOneAndUpdate(
    { assignmentId: seededAssignments[1]._id, studentId: student._id },
    {
      $set: {
        score: null,
        scorePercent: null,
        obtainedMarks: null,
        status: 'submitted',
        submittedAt: new Date(),
        submittedOnTime: true,
        isLate: false,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  await Promise.all(seededAssignments.slice(0, 2).map((assignment) => recomputeAssignmentStats(assignment._id)));
  console.log(`Seeded ${seededAssignments.length} assignments and 2 submissions for ${studentUser.id}.`);
}

try {
  await seed();
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
