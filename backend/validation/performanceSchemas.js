import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid resource ID is required.');

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const performanceQueryBaseSchema = z.object({
  fromSemester: z.coerce.number().int().min(1).optional(),
  toSemester: z.coerce.number().int().min(1).optional(),
  courseId: z.string().trim().min(1).max(100).optional(),
  includeCohort: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
});

const semesterRangeIsValid = (query) =>
  query.fromSemester == null || query.toSemester == null || query.fromSemester <= query.toSemester;
const semesterRangeIssue = { message: 'fromSemester must not be greater than toSemester.' };
export const performanceQuerySchema = performanceQueryBaseSchema.refine(
  semesterRangeIsValid,
  semesterRangeIssue
);

export const listQuerySchema = pagination.extend({
  semesterId: objectId.optional(),
  status: z.enum(['pending', 'submitted', 'graded', 'late']).optional(),
});

export const performanceExportQuerySchema = performanceQueryBaseSchema.extend({
  format: z.enum(['csv']).default('csv'),
}).refine(semesterRangeIsValid, semesterRangeIssue);

export const academicSettingsQuerySchema = z.object({
  programId: z.string().trim().min(1).max(100).optional(),
});

const enrollmentInput = z.object({
  courseId: objectId,
  credits: z.coerce.number().min(0),
  grade: z.string().trim().max(20).optional().default(''),
  gradePoint: z.coerce.number().min(0).max(10),
  gradeStatus: z.enum(['graded', 'incomplete', 'withdrawn']).default('graded'),
  attempt: z.coerce.number().int().min(1).default(1),
});

export const semesterInputSchema = z.object({
  studentId: z.string().trim().min(1).max(100),
  semesterNumber: z.coerce.number().int().min(1),
  academicYear: z.string().trim().min(4).max(20),
  status: z.enum(['completed', 'current']).default('completed'),
  enrollments: z.array(enrollmentInput).max(50).optional(),
});

export const semesterPatchSchema = semesterInputSchema
  .omit({ studentId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one semester field is required.',
  });

export const assignmentInputSchema = z.object({
  courseId: z.string().trim().min(1).max(100),
  semesterId: objectId,
  title: z.string().trim().min(2).max(200),
  type: z.string().trim().min(1).max(40).default('assignment'),
  dueDate: z.coerce.date(),
  maxScore: z.coerce.number().positive(),
  weightPercent: z.coerce.number().min(0).max(100),
  cohortId: z.string().trim().max(100).optional(),
});

export const assignmentPatchSchema = assignmentInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one assignment field is required.' }
);

export const submissionInputSchema = z.object({});

export const gradeInputSchema = z.object({
  score: z.coerce.number().min(0),
});

export const academicSettingsSchema = z.object({
  programId: z.string().trim().min(1).max(100).optional(),
  distinctionThreshold: z.coerce.number().min(0).max(10).optional(),
  distinctionLabel: z.string().trim().min(2).max(100).optional(),
  benchmarkPercent: z.coerce.number().min(0).max(100).optional(),
  privacyThreshold: z.coerce.number().int().min(1).max(1000).optional(),
  gpaScale: z.coerce.number().positive().max(10).optional(),
  repeatPolicy: z.enum(['latest', 'all']).optional(),
  withdrawalPolicy: z.enum(['exclude', 'include']).optional(),
  incompletePolicy: z.enum(['exclude', 'include']).optional(),
  excludeOwnScore: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one academic setting is required.',
});

export { objectId, pagination };
