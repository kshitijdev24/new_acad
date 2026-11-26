import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid resource ID is required.');

export const subjectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
});

export const syllabusInputSchema = z.object({
  units: z.array(
    z.object({
      name: z.string().trim().min(2).max(200),
      order: z.number().int().min(1).max(100),
      syllabusWeight: z.number().min(0).max(1).optional().default(1),
      topics: z.array(
        z.object({
          name: z.string().trim().min(2).max(240),
          keywords: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
          syllabusWeight: z.number().min(0).max(1).optional().default(1),
        })
      ).min(1).max(100),
    })
  ).min(1).max(50),
});

export const extractedQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      number: z.string().trim().min(1).max(30),
      subPart: z.string().trim().max(20).optional().default(''),
      section: z.string().trim().max(80).optional().default(''),
      choiceGroupId: z.string().trim().max(80).optional().default(''),
      text: z.string().trim().min(5).max(10000),
      marks: z.number().min(0).max(1000).nullable().optional(),
      type: z.enum(['mcq', 'short', 'long', 'numerical', 'case']),
      difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
    })
  ).min(1).max(300),
});

export const mappingOutputSchema = z.object({
  mappings: z.array(
    z.object({
      index: z.number().int().min(0),
      topicId: objectId.nullable(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export const questionPatchSchema = z.object({
  text: z.string().trim().min(5).max(10000).optional(),
  marks: z.number().min(0).max(1000).nullable().optional(),
  unitId: objectId.nullable().optional(),
  topicIds: z.array(objectId).max(5).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one question field is required.');

export const probablePaperInputSchema = z.object({
  totalMarks: z.number().int().min(1).max(1000),
  duration: z.number().int().min(1).max(1440),
  patternFromPaperId: objectId.optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idSchema = objectId;
