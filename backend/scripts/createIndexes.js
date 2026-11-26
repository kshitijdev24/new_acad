import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
  AcademicSettings,
  Assignment,
  AssignmentStats,
  AuditLog,
  Course,
  CourseFaculty,
  CourseEnrollment,
  CustomDomain,
  DailyQuota,
  Department,
  Enrollment,
  EmbeddingCache,
  Institution,
  ProbablePaper,
  PyqJob,
  PyqPaper,
  Question,
  Notification,
  Reminder,
  Subject,
  Student,
  StudentAssignmentState,
  Semester,
  Submission,
  StudentAssignmentState,
  Reminder,
  Notification,
  Topic,
  TopicStats,
  Unit,
  UnitStats,
  University,
} from '../models.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before creating indexes.');

try {
  await mongoose.connect(process.env.MONGODB_URI);
  let courseIndexes = [];
  try {
    courseIndexes = await Course.collection.indexes();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
  }
  for (const index of courseIndexes) {
    if (index.unique && Object.keys(index.key || {}).join(',') === 'code') {
      await Course.collection.dropIndex(index.name);
      console.log(`Dropped obsolete global course code index ${index.name}.`);
    }
  }
  let indexes = [];
  try {
    indexes = await Question.collection.indexes();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
  }
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    if (
      index.unique &&
      keys.join(',') === 'paperId,number,subPart'
    ) {
      await Question.collection.dropIndex(index.name);
      console.log(`Dropped obsolete unique index ${index.name}.`);
    }
  }
  const models = [
    Student,
    Semester,
    CourseEnrollment,
    Assignment,
    Submission,
    AssignmentStats,
    AcademicSettings,
    Institution,
    University,
    Department,
    CustomDomain,
    Course,
    CourseFaculty,
    Enrollment,
    AuditLog,
    Subject,
    Unit,
    Topic,
    PyqPaper,
    Question,
    TopicStats,
    UnitStats,
    PyqJob,
    ProbablePaper,
    DailyQuota,
    EmbeddingCache,
  ];
  for (const model of models) await model.createIndexes();
  console.log('PYQ indexes created.');
} finally {
  await mongoose.disconnect();
}
