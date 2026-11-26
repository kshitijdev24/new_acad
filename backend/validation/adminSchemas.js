import { z } from 'zod';

const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const courseStatus = z.enum(['active', 'inactive', 'archived', 'upcoming']);

export const domainInputSchema = z.object({
  domain: z.string().trim().min(1).max(253),
}).strict();

export const institutionPatchSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  shortName: z.string().trim().min(2).max(30).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  affiliation: z.object({
    university: z.string().trim().min(2).max(200).optional(),
    short: z.string().trim().min(2).max(30).optional(),
  }).strict().optional(),
  accreditations: z.array(z.string().trim().min(2).max(100)).max(20).optional(),
  nirfBand: z.string().trim().max(40).optional(),
  department: z.object({
    name: z.string().trim().min(2).max(200).optional(),
    code: z.string().trim().min(2).max(30).optional(),
  }).strict().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one institution or department field is required.',
});

export const courseListQuerySchema = z.object({
  ...pageFields,
  search: z.string().trim().max(100).optional(),
  status: courseStatus.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
});

export const courseInputSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(200),
  credits: z.coerce.number().min(0).max(20),
  capacity: z.coerce.number().int().min(0).max(10000).default(70),
  status: courseStatus.default('active'),
  session: z.string().trim().min(4).max(20).default('2026-27'),
  semester: z.coerce.number().int().min(1).max(12).default(1),
}).strict();

export const coursePatchSchema = courseInputSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one course field is required.' }
);

export const courseStatusSchema = z.object({ status: courseStatus }).strict();

export const courseDeleteQuerySchema = z.object({
  force: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});

export const courseFacultySchema = z.object({
  facultyIds: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  primaryFacultyId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict().refine(
  (value) => new Set(value.facultyIds).size === value.facultyIds.length,
  { message: 'Faculty cannot be assigned more than once.' }
).refine(
  (value) => value.primaryFacultyId == null || value.facultyIds.includes(value.primaryFacultyId),
  { message: 'The primary faculty member must be included in facultyIds.' }
);

export const enrollmentsQuerySchema = z.object(pageFields);

export const courseExportQuerySchema = z.object({
  format: z.enum(['csv']).default('csv'),
  status: courseStatus.optional(),
});
