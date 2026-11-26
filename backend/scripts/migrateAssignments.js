import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Assignment, Course } from '../models.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

async function migrate() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before migrating assignments.');
  await mongoose.connect(process.env.MONGODB_URI);
  const records = await Assignment.find({
    $or: [
      { courseId: { $exists: false } },
      { institutionId: { $exists: false } },
      { source: { $exists: false } },
      { lifecycleStatus: { $exists: false } },
    ],
  });
  let migrated = 0;
  let skipped = 0;
  for (const assignment of records) {
    let course = assignment.courseId ? await Course.findById(assignment.courseId) : null;
    if (!course) {
      const candidates = await Course.find({
        code: String(assignment.courseCode || '').trim().toUpperCase(),
        ...(assignment.institutionId ? { institutionId: assignment.institutionId } : {}),
      }).limit(2);
      if (candidates.length !== 1) {
        skipped += 1;
        continue;
      }
      [course] = candidates;
    }
    if (!course.institutionId || !assignment.dueDate || Number.isNaN(new Date(assignment.dueDate).getTime())) {
      skipped += 1;
      continue;
    }

    assignment.courseId = course._id;
    assignment.institutionId = course.institutionId;
    assignment.source = 'faculty';
    assignment.lifecycleStatus = 'published';
    assignment.deletedAt = null;
    assignment.createdBy ||= course.facultyUserId || 'system:assignment-migration';
    await assignment.save();
    migrated += 1;
  }
  console.log(`Migrated ${migrated} assignments; skipped ${skipped} ambiguous or unscoped records.`);
}

try {
  await migrate();
} finally {
  if (mongoose.connection.readyState) await mongoose.disconnect();
}
