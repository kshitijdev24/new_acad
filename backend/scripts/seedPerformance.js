import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  AcademicSettings,
  Assignment,
  Course,
  CourseEnrollment,
  Semester,
  Student,
  Submission,
  User,
} from '../models.js';
import { HISTORICAL_ASSIGNMENT_PERFORMANCE, HISTORICAL_SEMESTER_RECORDS } from '../../frontend/src/data/performanceData.js';
import { recomputeAssignmentStats, recomputeStudentSemesters } from '../services/performanceService.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const DEMO_USER_ID = process.env.PERFORMANCE_DEMO_USER_ID || 'usr-student-01';
const COHORT_ID = 'CSE-demo-2024';
const monthNumbers = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function isoDate(shortDate) {
  const [month, day] = shortDate.split(' ');
  return `2026-${monthNumbers[month]}-${day.padStart(2, '0')}T23:59:59.000Z`;
}

function assignmentType(title) {
  if (/lab/i.test(title)) return 'lab';
  if (/problem set/i.test(title)) return 'problemSet';
  if (/midterm|quiz/i.test(title)) return 'midterm';
  return 'assignment';
}

async function ensureCourse({ code, name, credits }) {
  return Course.findOneAndUpdate(
    { code },
    {
      $setOnInsert: {
        name,
        credits,
        facultyName: 'Demo Faculty',
        schedule: 'To be announced',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding academic performance.');
  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ id: DEMO_USER_ID });
  if (!user) {
    user = await User.create({
      id: DEMO_USER_ID,
      name: 'Demo Student',
      email: 'demo.student@example.invalid',
      role: 'student',
      department: 'Computer Science and Engineering',
    });
  }
  const demo = await Student.findOneAndUpdate(
    { userId: user.id },
    { $set: { programId: user.department, enrollmentYear: 2024, cohortId: COHORT_ID } },
    { upsert: true, new: true }
  );
  const syntheticStudents = [];
  for (let index = 1; index <= 30; index += 1) {
    syntheticStudents.push(await Student.findOneAndUpdate(
      { userId: `demo-cohort-${String(index).padStart(2, '0')}` },
      {
        $set: { programId: user.department, enrollmentYear: 2024, cohortId: COHORT_ID },
      },
      { upsert: true, new: true }
    ));
  }

  const semesters = [];
  for (const record of HISTORICAL_SEMESTER_RECORDS) {
    const semester = await Semester.findOneAndUpdate(
      { studentId: demo._id, semesterNumber: record.semester },
      {
        $set: {
          academicYear: record.year,
          status: record.isCurrent ? 'current' : 'completed',
          credits: record.credits,
          sgpa: record.sgpa,
          cgpa: record.cgpa,
        },
      },
      { upsert: true, new: true }
    );
    const creditsEach = Math.floor(record.credits / 4);
    let remainingCredits = record.credits;
    const gradePoints = [];
    for (let index = 0; index < 4; index += 1) {
      const credits = index === 3 ? remainingCredits : Math.min(creditsEach, remainingCredits);
      remainingCredits -= credits;
      const code = `PERF-S${record.semester}-${index + 1}`;
      const course = await ensureCourse({
        code,
        name: `${record.name} Course ${index + 1}`,
        credits,
      });
      gradePoints.push({
        courseId: course._id,
        credits,
        gradePoint: record.sgpa,
        gradeStatus: 'graded',
        attempt: 1,
      });
      await CourseEnrollment.findOneAndUpdate(
        { studentId: demo._id, semesterId: semester._id, courseId: course._id, attempt: 1 },
        {
          $set: {
            credits,
            grade: 'Demo',
            gradePoint: record.sgpa,
            gradeStatus: 'graded',
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }
    semester.gradePoints = gradePoints;
    await semester.save();
    semesters.push(semester);
  }

  for (const fixture of HISTORICAL_ASSIGNMENT_PERFORMANCE) {
    const course = await ensureCourse({
      code: fixture.courseCode,
      name: fixture.courseCode,
      credits: 3,
    });
    await CourseEnrollment.findOneAndUpdate(
      { studentId: demo._id, semesterId: semesters[4]._id, courseId: course._id, attempt: 1 },
      {
        $setOnInsert: {
          credits: course.credits,
          grade: '',
          gradePoint: 0,
          gradeStatus: 'incomplete',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    const assignment = await Assignment.findOneAndUpdate(
      { id: fixture.id },
      {
        $set: {
          title: fixture.title,
          courseCode: fixture.courseCode,
          courseId: course._id,
          semesterId: semesters[4]._id,
          type: assignmentType(fixture.title),
          dueDate: isoDate(fixture.date),
          maxScore: fixture.maxMarks,
          maxMarks: fixture.maxMarks,
          weightPercent: fixture.weight,
          cohortId: COHORT_ID,
          status: 'Pending',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    const status = fixture.status === 'Graded' ? 'graded' : 'submitted';
    await Submission.findOneAndUpdate(
      { assignmentId: assignment._id, studentId: demo._id },
      {
        $set: {
          score: fixture.scorePercent * fixture.maxMarks / 100,
          scorePercent: fixture.scorePercent,
          status,
          submittedAt: new Date(new Date(isoDate(fixture.date)).getTime() - 24 * 60 * 60 * 1000),
          submittedOnTime: true,
          gradedAt: status === 'graded' ? new Date() : null,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    const gradedStudentCount = syntheticStudents.length + (status === 'graded' ? 1 : 0);
    const baseScore = (
      fixture.classAveragePercent * gradedStudentCount
      - (status === 'graded' ? fixture.scorePercent : 0)
    ) / syntheticStudents.length;
    for (const [index, student] of syntheticStudents.entries()) {
      const variation = (index - ((syntheticStudents.length - 1) / 2)) * 0.6;
      const scorePercent = Math.max(0, Math.min(100, baseScore + variation));
      await Submission.findOneAndUpdate(
        { assignmentId: assignment._id, studentId: student._id },
        {
          $set: {
            score: scorePercent * fixture.maxMarks / 100,
            scorePercent,
            status: 'graded',
            submittedAt: new Date(new Date(isoDate(fixture.date)).getTime() - 24 * 60 * 60 * 1000),
            submittedOnTime: true,
            gradedAt: new Date(),
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }
    await recomputeAssignmentStats(assignment._id);
  }
  await AcademicSettings.findOneAndUpdate(
    { programId: 'default' },
    {
      $setOnInsert: {
        distinctionThreshold: 3.5,
        distinctionLabel: "Dean's Honor Roll",
        benchmarkPercent: 80,
        privacyThreshold: Number(process.env.PERFORMANCE_PRIVACY_THRESHOLD) || 5,
      },
    },
    { upsert: true, new: true }
  );
  await recomputeStudentSemesters(demo._id);
  console.log(`Seeded performance fixtures for ${syntheticStudents.length + 1} cohort students.`);
}

try {
  await seed();
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
