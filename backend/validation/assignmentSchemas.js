import { z } from 'zod';

const assignmentFields = {
  title: z.string().trim().min(1).max(150),
  courseId: z.string().trim().min(1).max(100),
  description: z.string().max(10000).optional().default(''),
  dueDate: z.string().trim().min(10).max(40),
  weightPercent: z.coerce.number().min(1).max(100),
  maxMarks: z.coerce.number().min(10).max(200).optional(),
  maxScore: z.coerce.number().min(0).max(200).optional(),
  semesterId: z.string().trim().min(1).max(100).optional(),
  type: z.string().trim().min(1).max(50).optional(),
  cohortId: z.string().trim().max(100).optional(),
  allowLateSubmission: z.boolean().optional().default(false),
  latePenaltyPercent: z.coerce.number().min(0).max(100).optional().default(0),
  allowedFileTypes: z.array(z.enum(['.pdf', '.zip', '.java', '.py', '.docx']))
    .min(1)
    .max(5)
    .optional()
    .default(['.pdf', '.zip', '.java', '.py', '.docx']),
  maxFileSizeMB: z.coerce.number().int().min(1).max(100).optional(),
};

export const assignmentCreateSchema = z.object(assignmentFields).strict().refine(
  (value) => value.maxMarks !== undefined || value.maxScore !== undefined,
  { message: 'Maximum marks are required.' }
);

export const assignmentPatchSchema = z.object({
  title: assignmentFields.title.optional(),
  description: z.string().max(10000).optional(),
  dueDate: assignmentFields.dueDate.optional(),
  weightPercent: assignmentFields.weightPercent.optional(),
  maxMarks: assignmentFields.maxMarks.optional(),
  maxScore: assignmentFields.maxScore.optional(),
  type: assignmentFields.type.optional(),
  cohortId: assignmentFields.cohortId.optional(),
  allowLateSubmission: z.boolean().optional(),
  latePenaltyPercent: z.coerce.number().min(0).max(100).optional(),
  allowedFileTypes: z.array(z.enum(['.pdf', '.zip', '.java', '.py', '.docx'])).min(1).max(5).optional(),
  maxFileSizeMB: assignmentFields.maxFileSizeMB,
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one field to update.',
});

export const assignmentListSchema = z.object({
  status: z.enum(['All', 'DueSoon', 'Pending', 'Completed', 'Overdue']).default('All'),
  courseCode: z.string().trim().max(30).optional(),
  sortBy: z.enum(['dueDate', 'weight']).default('dueDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const completionSchema = z.object({
  completed: z.boolean(),
}).strict();

export const submitSchema = z.object({
  note: z.string().trim().max(2000).optional().default(''),
}).strict();

export const gradeAssignmentSchema = z.object({
  obtainedMarks: z.coerce.number().min(0).max(200).optional(),
  score: z.coerce.number().min(0).max(200).optional(),
  feedback: z.string().trim().max(5000).optional().default(''),
}).strict().refine(
  (value) => value.obtainedMarks !== undefined || value.score !== undefined,
  { message: 'A grade is required.' }
);

export const assignmentIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'A valid assignment ID is required.');

export const notificationListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  unreadOnly: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
}).strict();
