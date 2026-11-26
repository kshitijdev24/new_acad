import { jest } from '@jest/globals';
import request from 'supertest';

const generatedResponses = [];
const generateContent = jest.fn(async () => ({ text: generatedResponses.shift() }));
jest.unstable_mockModule('../services/aiClient.js', () => ({
  getGeminiClient: () => ({ models: { generateContent } }),
  getLlmModel: () => 'test-model',
}));

const { parseQuestionPaper } = await import('../services/parsing.js');
const { calculateImportance } = await import('../services/scoring.js');
const { buildPaperSlots } = await import('../services/probablePaper.js');
const {
  assertNoDuplicateHashes,
  isSupportedUpload,
  uploadMetadataSchema,
} = await import('../routes/pyqRoutes.js');
const { default: pyqRouter } = await import('../routes/pyqRoutes.js');

describe('PYQ feature validation', () => {
  beforeEach(() => {
    generatedResponses.length = 0;
    generateContent.mockClear();
  });

  test('accepts supported file types and rejects MIME/extension mismatches', () => {
    expect(isSupportedUpload({
      originalname: 'paper.pdf',
      mimetype: 'application/pdf',
    })).toBe(true);
    expect(isSupportedUpload({
      originalname: 'paper.pdf',
      mimetype: 'image/png',
    })).toBe(false);
  });

  test('rejects file hashes already uploaded or repeated in one batch', () => {
    expect(() => assertNoDuplicateHashes(['one', 'two'], ['one']))
      .toThrow('One or more selected papers have already been uploaded.');
    expect(() => assertNoDuplicateHashes(['same', 'same']))
      .toThrow('One or more selected papers have already been uploaded.');
    expect(() => assertNoDuplicateHashes(['one', 'two'])).not.toThrow();
  });

  test('validates upload metadata and normalizes multipart form values', () => {
    const parsed = uploadMetadataSchema.parse({
      subjectId: '0123456789abcdef01234567',
      examName: 'End Semester',
      year: '2024',
      totalMarks: '100',
      duration: '180',
    });
    expect(parsed).toMatchObject({
      year: 2024,
      totalMarks: 100,
      duration: 180,
      session: '',
    });
    expect(() => uploadMetadataSchema.parse({
      subjectId: 'bad-id',
      examName: 'X',
      year: '1700',
    })).toThrow();
  });

  test('retries malformed LLM JSON and validates parsed question schema', async () => {
    generatedResponses.push(
      JSON.stringify({ questions: [] }),
      JSON.stringify({
        questions: [{
          number: '1',
          subPart: 'a',
          section: 'Section A',
          text: 'Explain how binary search reduces the search range.',
          marks: 5,
          type: 'short',
          difficulty: 'easy',
        }],
      })
    );
    const parsed = await parseQuestionPaper('Question paper text', undefined);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].number).toBe('1');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test('scores fixed topic fixtures deterministically', () => {
    const result = calculateImportance({
      currentYear: 2025,
      units: [
        { _id: 'unit-1', syllabusWeight: 0.5 },
        { _id: 'unit-2', syllabusWeight: 0.5 },
      ],
      topics: [
        { _id: 'topic-1', unitId: 'unit-1', syllabusWeight: 0.5 },
        { _id: 'topic-2', unitId: 'unit-2', syllabusWeight: 0.5 },
      ],
      questions: [
        { paperId: 'paper-1', year: 2022, marks: 10, topicIds: ['topic-1'] },
        { paperId: 'paper-2', year: 2023, marks: 10, topicIds: ['topic-1'] },
        { paperId: 'paper-3', year: 2024, marks: 10, topicIds: ['topic-1'] },
        { paperId: 'paper-3', year: 2024, marks: 10, topicIds: ['topic-2'] },
      ],
    });
    expect(result.topicStats.find((topic) => topic.id === 'topic-1')).toMatchObject({
      importanceScore: 100,
      level: 'high',
      frequency: 3,
      marksPercent: 75,
      lastYearAppeared: 2024,
    });
    expect(result.topicStats.find((topic) => topic.id === 'topic-2').level).toBe('medium');
  });

  test('allocates exactly the requested marks while preserving paper sections', () => {
    const slots = buildPaperSlots(35, [
      { section: 'Section A', marks: 10, type: 'long' },
      { section: 'Section A', marks: 10, type: 'short' },
      { section: 'Section B', marks: 10, type: 'numerical' },
      { section: 'Section B', marks: 5, type: 'mcq' },
    ]);
    expect(slots.reduce((sum, slot) => sum + slot.marks, 0)).toBe(35);
    expect(new Set(slots.map((slot) => slot.section))).toEqual(new Set(['Section A', 'Section B']));
    expect(slots.every((slot) => ['long', 'short', 'numerical', 'mcq'].includes(slot.type))).toBe(true);
  });

  test('requires an authenticated user before touching PYQ storage', async () => {
    const app = (await import('express')).default();
    app.use('/api/v1', pyqRouter);
    const response = await request(app).get('/api/v1/subjects');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Authentication required.',
      data: null,
    });
  });
});
