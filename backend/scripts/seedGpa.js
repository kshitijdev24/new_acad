import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  ComponentScore,
  Course,
  CourseEnrollment,
  CourseEvaluationScheme,
  CourseResult,
  GradingScale,
  Semester,
  Student,
  User,
} from '../models.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const DEMO_USER_ID = process.env.GPA_DEMO_USER_ID || 'usr-student-01';
const FOUR_POINT_SCALE = {
  programId: 'Computer Science and Engineering',
  name: '4.0 Scale',
  maxPoints: 4,
  minTarget: 2,
  maxTarget: 4,
  step: 0.05,
  rounding: { sgpaDecimals: 2, mode: 'half-up' },
  selectableGrades: ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'],
  grades: [
    { letter: 'A', points: 4, minPercent: 90, isPassing: true },
    { letter: 'A-', points: 3.7, minPercent: 85, isPassing: true },
    { letter: 'B+', points: 3.3, minPercent: 80, isPassing: true },
    { letter: 'B', points: 3, minPercent: 70, isPassing: true },
    { letter: 'B-', points: 2.7, minPercent: 65, isPassing: true },
    { letter: 'C+', points: 2.3, minPercent: 60, isPassing: true },
    { letter: 'C', points: 2, minPercent: 50, isPassing: true },
    { letter: 'F', points: 0, minPercent: 0, isPassing: false },
  ],
};
const TEN_POINT_SCALE = {
  programId: 'demo-10-point',
  name: '10.0 Scale',
  maxPoints: 10,
  minTarget: 4,
  maxTarget: 10,
  step: 0.1,
  rounding: { sgpaDecimals: 2, mode: 'half-up' },
  selectableGrades: ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'],
  grades: [
    { letter: 'O', points: 10, minPercent: 90, isPassing: true },
    { letter: 'A+', points: 9, minPercent: 80, isPassing: true },
    { letter: 'A', points: 8, minPercent: 70, isPassing: true },
    { letter: 'B+', points: 7, minPercent: 60, isPassing: true },
    { letter: 'B', points: 6, minPercent: 50, isPassing: true },
    { letter: 'C', points: 5, minPercent: 40, isPassing: true },
    { letter: 'F', points: 0, minPercent: 0, isPassing: false },
  ],
};
const DEMO_COURSES = [
  { code: 'GPA-CS101', name: 'Algorithms and Data Structures', credits: 4, facultyName: 'Dr. Kavita Rao', attendancePercent: 92, score: 92, final: true },
  { code: 'GPA-MATH201', name: 'Applied Mathematics', credits: 3, facultyName: 'Prof. Arjun Mehta', attendancePercent: 84, score: 80, final: false },
  { code: 'GPA-PHYS101', name: 'Engineering Physics', credits: 3, facultyName: 'Dr. Neha Gupta', attendancePercent: 79, score: 85.5, final: false },
  { code: 'GPA-ENG101', name: 'Technical Communication', credits: 2, facultyName: 'Ms. Deepika Yadav', attendancePercent: 68, score: 72, final: false },
  { code: 'GPA-STAT102', name: 'Applied Statistics', credits: 1, facultyName: 'Prof. Raj Sharma', attendancePercent: 88, score: 88, final: false },
  { code: 'GPA-LAB103', name: 'Computing Laboratory', credits: 1, facultyName: 'Ms. Deepika Yadav', attendancePercent: 90, score: 82, final: false },
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding GPA fixtures.');
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ id: DEMO_USER_ID });
  if (!user) throw new Error(`Demo account ${DEMO_USER_ID} was not found. Seed the app accounts first.`);
  const programId = user.department || FOUR_POINT_SCALE.programId;

  await GradingScale.findOneAndUpdate(
    { programId },
    { $set: { ...FOUR_POINT_SCALE, programId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await GradingScale.findOneAndUpdate(
    { programId: TEN_POINT_SCALE.programId },
    { $set: TEN_POINT_SCALE },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const student = await Student.findOneAndUpdate(
    { userId: user.id },
    {
      $set: {
        programId,
        enrollmentYear: new Date().getFullYear() - 2,
        cohortId: `${programId}-gpa-demo`,
      },
    },
    { upsert: true, new: true }
  );

  for (const [index, credits] of [18, 18, 17, 17].entries()) {
    const semester = await Semester.findOneAndUpdate(
      { studentId: student._id, semesterNumber: index + 1 },
      {
        $set: {
          academicYear: `${2022 + index}-${String(2023 + index).slice(-2)}`,
          status: 'completed',
          credits,
        },
      },
      { upsert: true, new: true }
    );
    const code = `GPA-HIST-S${index + 1}`;
    const course = await Course.findOneAndUpdate(
      { code },
      {
        $set: {
          name: `Historical Semester ${index + 1}`,
          credits,
          facultyName: 'Academic Records',
          semester: index + 1,
          gradingType: 'letter',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await CourseEnrollment.findOneAndUpdate(
      { studentId: student._id, semesterId: semester._id, courseId: course._id, attempt: 1 },
      {
        $set: {
          credits,
          grade: 'B+',
          gradePoint: 3.3,
          gradeStatus: 'graded',
          attempt: 1,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  const semester = await Semester.findOneAndUpdate(
    { studentId: student._id, semesterNumber: 5 },
    {
      $set: { academicYear: '2026-27', status: 'current', credits: 14 },
    },
    { upsert: true, new: true }
  );
  const courseIds = [];
  for (const item of DEMO_COURSES) {
    const course = await Course.findOneAndUpdate(
      { code: item.code },
      {
        $set: {
          name: item.name,
          credits: item.credits,
          facultyName: item.facultyName,
          attendancePercent: item.attendancePercent,
          gradingType: 'letter',
          semester: 5,
          session: '2026-27',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    courseIds.push(course._id);
    const letter = FOUR_POINT_SCALE.grades
      .filter((grade) => item.score >= grade.minPercent)
      .sort((left, right) => right.minPercent - left.minPercent)[0];
    await CourseEnrollment.findOneAndUpdate(
      { studentId: student._id, semesterId: semester._id, courseId: course._id, attempt: 1 },
      {
        $set: {
          credits: item.credits,
          grade: item.final ? letter.letter : '',
          gradePoint: item.final ? letter.points : 0,
          gradeStatus: item.final ? 'graded' : 'incomplete',
          attempt: 1,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    const components = [
      { name: 'Internal assessment', type: 'assessment', weightPercent: 60, maxMarks: 100 },
      { name: 'Final assessment', type: 'exam', weightPercent: 40, maxMarks: 100 },
    ];
    await CourseEvaluationScheme.findOneAndUpdate(
      { courseId: course._id, semesterId: semester._id },
      { $set: { components } },
      { upsert: true, new: true, runValidators: true }
    );
    await ComponentScore.findOneAndUpdate(
      {
        courseId: course._id,
        studentId: student._id,
        semesterId: semester._id,
        componentName: 'Internal assessment',
      },
      {
        $set: {
          obtainedMarks: item.score,
          maxMarks: 100,
          status: 'graded',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (item.final) {
      await CourseResult.findOneAndUpdate(
        { studentId: student._id, courseId: course._id, semesterId: semester._id, attempt: 1 },
        {
          $set: {
            letterGrade: letter.letter,
            gradePoints: letter.points,
            isFinal: true,
            attempt: 1,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }
  }
  await CourseEnrollment.deleteMany({
    studentId: student._id,
    semesterId: semester._id,
    courseId: { $nin: courseIds },
  });
  console.log(`Seeded 2 scales and ${DEMO_COURSES.length} current GPA courses for ${user.id}.`);
}

try {
  await seed();
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
