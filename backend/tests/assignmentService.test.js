import { jest } from '@jest/globals';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  Assignment,
  Course,
  CourseEnrollment,
  Notification,
  Reminder,
  Student,
} from '../models.js';
import {
  AssignmentError,
  canManageCourse,
  createAssignmentReminder,
  getAssignmentByIdForUser,
  gradeAssignment,
  markNotificationRead,
} from '../services/assignmentService.js';
import {
  assignmentCreateSchema,
  assignmentListSchema,
  gradeAssignmentSchema,
} from '../validation/assignmentSchemas.js';
import assignmentRouter from '../routes/assignmentRoutes.js';

describe('assignment tracker validation and access control', () => {
  afterEach(() => jest.restoreAllMocks());

  test('validates assignment creation, list pagination, and legacy grading input', () => {
    expect(assignmentCreateSchema.parse({
      courseId: 'course-a',
      title: 'Lab report',
      dueDate: '2027-01-15',
      weightPercent: 10,
      maxMarks: 100,
    })).toMatchObject({ title: 'Lab report', maxMarks: 100 });
    expect(() => assignmentCreateSchema.parse({
      courseId: 'course-a',
      title: 'Bad file type',
      dueDate: '2027-01-15',
      weightPercent: 10,
      maxMarks: 100,
      allowedFileTypes: ['.exe'],
    })).toThrow();
    expect(assignmentListSchema.parse({ page: '2', limit: '50' })).toMatchObject({
      page: 2,
      limit: 50,
    });
    expect(gradeAssignmentSchema.parse({ score: 91 })).toMatchObject({ score: 91 });
    expect(() => gradeAssignmentSchema.parse({ obtainedMarks: 201 })).toThrow();
  });

  test('mounts the assignment API documentation endpoint', async () => {
    const app = express();
    app.use('/api/v1', assignmentRouter);
    await request(app).get('/api/v1/assignments/docs').expect(200);
  });

  test('a student cannot read another student personal assignment', async () => {
    const institutionId = new mongoose.Types.ObjectId();
    const student = { _id: new mongoose.Types.ObjectId(), userId: 'student-a' };
    const assignment = {
      _id: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
      source: 'personal',
      ownerStudentId: new mongoose.Types.ObjectId(),
    };
    jest.spyOn(Assignment, 'findOne').mockResolvedValue(assignment);
    jest.spyOn(Student, 'findOne').mockResolvedValue(student);
    jest.spyOn(Course, 'findById').mockImplementation(() => ({
      select: () => ({ lean: () => Promise.resolve({ institutionId }) }),
    }));
    jest.spyOn(CourseEnrollment, 'exists').mockResolvedValue(false);

    await expect(getAssignmentByIdForUser(
      { id: 'student-a', role: 'student', institutionId },
      String(assignment._id)
    )).rejects.toMatchObject({ status: 404 });
  });

  test('faculty course access is rejected across institution boundaries', async () => {
    await expect(canManageCourse(
      { id: 'faculty-a', role: 'faculty', institutionId: new mongoose.Types.ObjectId() },
      { institutionId: new mongoose.Types.ObjectId() }
    )).rejects.toBeInstanceOf(AssignmentError);
  });

  test('grading is rejected before mutation when the course belongs to another tenant', async () => {
    const assignment = {
      _id: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
    };
    jest.spyOn(Assignment, 'findById').mockResolvedValue(assignment);
    jest.spyOn(Course, 'findById').mockResolvedValue({
      institutionId: new mongoose.Types.ObjectId(),
    });
    const submission = {
      assignmentId: assignment._id,
      status: 'submitted',
      save: jest.fn(),
    };

    await expect(gradeAssignment(
      { id: 'faculty-a', role: 'faculty', institutionId: new mongoose.Types.ObjectId() },
      submission,
      { obtainedMarks: 90, feedback: '' },
      {}
    )).rejects.toMatchObject({ status: 403 });
    expect(submission.save).not.toHaveBeenCalled();
  });

  test('reminder creation is idempotent and notification reads are user-scoped', async () => {
    jest.spyOn(Reminder, 'create').mockRejectedValue({ code: 11000 });
    const createNotification = jest.spyOn(Notification, 'create');
    await expect(createAssignmentReminder(
      { _id: new mongoose.Types.ObjectId(), title: 'Lab' },
      { _id: new mongoose.Types.ObjectId(), userId: 'student-a' },
      '24h'
    )).resolves.toBe(false);
    expect(createNotification).not.toHaveBeenCalled();

    const notification = { _id: new mongoose.Types.ObjectId() };
    const update = jest.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(notification);
    await markNotificationRead({ id: 'student-a' }, String(notification._id));
    expect(update).toHaveBeenCalledWith(
      { _id: String(notification._id), userId: 'student-a' },
      { $set: { readAt: expect.any(Date) } },
      { new: true }
    );
  });
});
