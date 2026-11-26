import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  Assignment,
  Course,
  CourseEnrollment,
  Semester,
  SemesterRecord,
  Student,
  Submission,
  User,
} from '../models.js';
import { recomputeAssignmentStats, recomputeStudentSemesters } from '../services/performanceService.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const userId = process.env.PERFORMANCE_MIGRATION_USER_ID || 'usr-student-01';

async function findOrCreateCourse(code) {
  let course = await Course.findOne({ code });
  if (!course) {
    course = await Course.create({
      code,
      name: code,
      credits: 1,
      facultyName: 'Unassigned',
      schedule: 'To be announced',
    });
  }
  return course;
}

async function migrate() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before migrating academic records.');
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ id: userId });
  if (!user) throw new Error('The configured migration student does not exist.');
  const student = await Student.findOneAndUpdate(
    { userId: user.id },
    {
      $setOnInsert: {
        programId: user.department || '',
        enrollmentYear: new Date().getFullYear(),
        cohortId: `${user.department || 'program'}-${new Date().getFullYear()}`,
      },
    },
    { upsert: true, new: true }
  );
  const legacySemesters = await SemesterRecord.find().sort({ semester: 1 }).lean();
  for (const record of legacySemesters) {
    const semester = await Semester.findOneAndUpdate(
      { studentId: student._id, semesterNumber: record.semester },
      {
        $set: {
          academicYear: record.year,
          status: record.isCurrent ? 'current' : 'completed',
          sgpa: record.sgpa,
          cgpa: record.cgpa,
          credits: record.credits,
        },
      },
      { upsert: true, new: true }
    );
    const course = await findOrCreateCourse(`MIGRATED-SEM-${record.semester}`);
    await CourseEnrollment.findOneAndUpdate(
      { studentId: student._id, semesterId: semester._id, courseId: course._id, attempt: 1 },
      {
        $set: {
          credits: record.credits,
          grade: 'Migrated GPA',
          gradePoint: record.sgpa,
          gradeStatus: 'graded',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    semester.gradePoints = [{
      courseId: course._id,
      credits: record.credits,
      gradePoint: record.sgpa,
      gradeStatus: 'graded',
      attempt: 1,
    }];
    await semester.save();
  }

  const latestSemester = await Semester.findOne({ studentId: student._id }).sort({ semesterNumber: -1 });
  if (latestSemester) {
    const legacyAssignments = await Assignment.find({ semesterId: { $exists: false } });
    for (const assignment of legacyAssignments) {
      const course = await findOrCreateCourse(assignment.courseCode);
      assignment.courseId = course._id;
      assignment.semesterId = latestSemester._id;
      await CourseEnrollment.findOneAndUpdate(
        { studentId: student._id, semesterId: latestSemester._id, courseId: course._id, attempt: 1 },
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
      assignment.type = /lab/i.test(assignment.title)
        ? 'lab'
        : /problem set/i.test(assignment.title)
          ? 'problemSet'
          : /midterm|quiz/i.test(assignment.title)
            ? 'midterm'
            : 'assignment';
      assignment.maxScore = assignment.maxMarks;
      await assignment.save();
      if (assignment.obtainedMarks != null) {
        const maxScore = Number(assignment.maxScore || assignment.maxMarks);
        const submittedAt = assignment.submissionDate ? new Date(assignment.submissionDate) : null;
        const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
        await Submission.findOneAndUpdate(
          { assignmentId: assignment._id, studentId: student._id },
          {
            $set: {
              score: assignment.obtainedMarks,
              scorePercent: maxScore > 0 ? (assignment.obtainedMarks / maxScore) * 100 : null,
              status: 'graded',
              submittedAt,
              submittedOnTime: submittedAt && dueDate ? submittedAt <= dueDate : null,
              gradedAt: assignment.updatedAt || new Date(),
            },
          },
          { upsert: true, new: true, runValidators: true }
        );
      }
      await recomputeAssignmentStats(assignment._id);
    }
  }
  await recomputeStudentSemesters(student._id);
  console.log('Migrated legacy academic performance records.');
}

try {
  await migrate();
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
