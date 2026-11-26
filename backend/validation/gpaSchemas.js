import { z } from 'zod';

const semesterId = z.string().trim().min(1).max(100).default('current');
const gradeMap = z.record(z.string().trim().min(1).max(30), z.string().trim().min(1).max(10));

export const gpaEngineQuerySchema = z.object({
  semesterId,
  studentId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const gpaPredictSchema = z.object({
  semesterId,
  studentId: z.string().trim().min(1).max(100).optional(),
  predictedGrades: gradeMap.default({}),
  includeCumulative: z.boolean().default(true),
}).strict();

export const gpaTargetSolverSchema = z.object({
  semesterId,
  studentId: z.string().trim().min(1).max(100).optional(),
  targetGpa: z.coerce.number().finite(),
  lockedGrades: gradeMap.default({}),
  maxGrade: z.string().trim().min(1).max(10).optional(),
  preferCourses: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
}).strict();

export const requiredScoreSchema = z.object({
  semesterId,
  studentId: z.string().trim().min(1).max(100).optional(),
  desiredGrade: z.string().trim().min(1).max(10),
}).strict();

export const gpaScenarioCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  semesterId,
  predictedGrades: gradeMap.default({}),
  targetGpa: z.coerce.number().finite().nullable().optional(),
}).strict();

export const gpaScenarioPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  predictedGrades: gradeMap.optional(),
  targetGpa: z.coerce.number().finite().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one scenario field to update.',
});
