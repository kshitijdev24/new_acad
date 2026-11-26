import { randomBytes } from 'node:crypto';
import {
  Course,
  CourseFaculty,
  CustomDomain,
  Department,
  Enrollment,
  Institution,
  University,
  User,
} from '../models.js';

const INSTITUTION_NAME = "Bharati Vidyapeeth's College of Engineering";
const LEGACY_INSTITUTION = "Bharati Vidyapeeth's College of Engineering, New Delhi";
const COURSE_ENROLLMENTS = {
  CS101: 64,
  MATH201: 42,
  PHYS101: 38,
  ENG101: 29,
  CS201: 36,
  CS301: 32,
  CS401: 28,
};
const DEFAULT_COURSES = [
  { code: 'CS101', name: 'Introduction to Computer Science', credits: 3, facultyName: 'Ms. Deepika Yadav' },
  { code: 'MATH201', name: 'Calculus I', credits: 4, facultyName: 'Dr. R. K. Sharma' },
  { code: 'PHYS101', name: 'Physics for Engineers', credits: 4, facultyName: 'Dr. Neha Gupta' },
  { code: 'ENG101', name: 'Academic Writing', credits: 3, facultyName: 'Prof. S. Mukherjee' },
  { code: 'CS201', name: 'Data Structures and Algorithms', credits: 4, facultyName: 'Ms. Deepika Yadav' },
  { code: 'CS301', name: 'Database Management Systems', credits: 4, facultyName: 'Ms. Deepika Yadav' },
  { code: 'CS401', name: 'Operating Systems', credits: 4, facultyName: 'Dr. R. K. Sharma' },
];

async function removeLegacyGlobalCourseCodeIndex() {
  let indexes = [];
  try {
    indexes = await Course.collection.indexes();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
  }
  for (const index of indexes) {
    if (index.unique && Object.keys(index.key || {}).join(',') === 'code') {
      await Course.collection.dropIndex(index.name);
    }
  }
}

export async function ensureAdminDashboardSeed() {
  await removeLegacyGlobalCourseCodeIndex();
  const university = await University.findOneAndUpdate(
    { name: 'Guru Gobind Singh Indraprastha University', shortName: 'GGSIPU' },
    { $setOnInsert: { shortName: 'GGSIPU' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const institution = await Institution.findOneAndUpdate(
    { shortName: 'BVCOE' },
    {
      $setOnInsert: {
        name: INSTITUTION_NAME,
        shortName: 'BVCOE',
        city: 'New Delhi',
        state: 'Delhi',
        universityId: university._id,
        accreditations: ['AICTE Approved', 'NBA Accredited'],
        nirfBand: '201-300',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const department = await Department.findOneAndUpdate(
    { institutionId: institution._id, code: 'CSE' },
    { $setOnInsert: { name: 'Computer Science & Engineering' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const configuredDomain = await CustomDomain.findOne({
    institutionId: institution._id,
    releasedAt: { $exists: false },
  });
  if (!configuredDomain) {
    await CustomDomain.create({
      institutionId: institution._id,
      domain: 'portal.acadlytic.bvcoe.edu.in',
      status: 'pending_verification',
      recordType: 'CNAME',
      target: process.env.PLATFORM_CNAME_TARGET || 'cname.acadlytic-system.net',
      verificationToken: `acadlytic-verify=${randomBytes(24).toString('hex')}`,
      verificationType: 'TXT',
      createdBy: 'system:seed',
    });
  }

  await User.updateMany(
    { institution: LEGACY_INSTITUTION, institutionId: { $exists: false } },
    { $set: { institutionId: institution._id, departmentId: department._id } }
  );
  await User.updateMany(
    { institution: INSTITUTION_NAME, institutionId: { $exists: false } },
    { $set: { institutionId: institution._id, departmentId: department._id } }
  );
  await User.updateMany(
    { institutionId: institution._id, departmentId: { $exists: false } },
    { $set: { departmentId: department._id } }
  );

  const legacyCourses = await Course.find({ institutionId: { $exists: false } });
  const courseCodes = Object.keys(COURSE_ENROLLMENTS);
  const scopedCourses = legacyCourses.filter((course) => (
    courseCodes.includes(course.code)
  ));
  for (const course of scopedCourses) {
    course.institutionId = institution._id;
    course.departmentId = department._id;
    course.session = '2026-27';
    course.semester = 5;
    course.status = 'active';
    course.capacity = course.code === 'CS101' ? 70 : 60;
    await course.save();
  }

  for (const course of DEFAULT_COURSES) {
    await Course.findOneAndUpdate(
      {
        institutionId: institution._id,
        departmentId: department._id,
        code: course.code,
        session: '2026-27',
      },
      {
        $setOnInsert: {
          ...course,
          institutionId: institution._id,
          departmentId: department._id,
          session: '2026-27',
          semester: 5,
          capacity: course.code === 'CS101' ? 70 : 60,
          status: 'active',
          schedule: 'To be announced',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const seededCourses = await Course.find({
    institutionId: institution._id,
    departmentId: department._id,
    session: '2026-27',
    code: { $in: courseCodes },
  });
  for (const course of seededCourses) {
    const faculty = await User.findOne({
      institutionId: institution._id,
      role: 'faculty',
      name: course.facultyName,
    });
    if (faculty && !(await CourseFaculty.exists({ courseId: course._id, active: true }))) {
      await CourseFaculty.create({
        courseId: course._id,
        facultyId: faculty._id,
        role: 'primary',
        assignedBy: 'system:seed',
      });
    }

    const enrollmentCount = COURSE_ENROLLMENTS[course.code] || 0;
    const enrollments = Array.from({ length: enrollmentCount }, (_, studentIndex) => ({
      updateOne: {
        filter: {
          courseId: course._id,
          studentId: `demo-enrolled-${course.code}-${String(studentIndex + 1).padStart(3, '0')}`,
        },
        update: {
          $setOnInsert: {
            status: 'enrolled',
            enrolledAt: new Date(Date.UTC(2026, 7, 1 + (studentIndex % 20))),
          },
        },
        upsert: true,
      },
    }));
    if (enrollments.length) await Enrollment.bulkWrite(enrollments);
  }

  return { institution, department, coursesSeeded: seededCourses.length };
}
