import { randomUUID } from 'crypto';
import { mkdir, open, rm } from 'fs/promises';
import path from 'path';
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import {
  DailyQuota,
  ProbablePaper,
  PyqJob,
  PyqPaper,
  Question,
  Subject,
  Topic,
  TopicStats,
  Unit,
  UnitStats,
} from '../models.js';
import {
  AppError,
  asyncHandler,
  featureErrorHandler,
  requireFeatureAuth,
  sendSuccess,
} from '../utils/http.js';
import {
  idSchema,
  paginationSchema,
  probablePaperInputSchema,
  questionPatchSchema,
  subjectInputSchema,
  syllabusInputSchema,
} from '../validation/pyqSchemas.js';
import { reserveDailyQuota } from '../services/dailyQuota.js';
import { parseSyllabusText } from '../services/parsing.js';
import { recomputeSubjectStats } from '../services/recomputeStats.js';
import { generateProbablePaper } from '../services/probablePaper.js';
import { extractText } from '../services/extractText.js';
import {
  deleteStoredFile,
  ensureUploadDirectories,
  getTemporaryDirectory,
  hashFile,
  promoteUpload,
} from '../storage/localStorage.js';

const router = express.Router();
const allowedTypes = new Map([
  ['.pdf', 'application/pdf'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]);
export const uploadMetadataSchema = z.object({
  subjectId: idSchema,
  examName: z.string().trim().min(2).max(160),
  year: z.coerce.number().int().min(1900).max(2200),
  session: z.string().trim().max(80).optional().default(''),
  totalMarks: z.coerce.number().int().min(1).max(1000).optional(),
  duration: z.coerce.number().int().min(1).max(1440).optional(),
});

export function isSupportedUpload(file) {
  return allowedTypes.get(path.extname(file.originalname).toLowerCase()) === file.mimetype;
}

export function assertNoDuplicateHashes(hashes, existingHashes = []) {
  const seen = new Set(existingHashes);
  for (const hash of hashes) {
    if (seen.has(hash)) {
      throw new AppError(409, 'One or more selected papers have already been uploaded.');
    }
    seen.add(hash);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      mkdir(getTemporaryDirectory(), { recursive: true })
        .then(() => callback(null, getTemporaryDirectory()))
        .catch(callback);
    },
    filename: (req, file, callback) => {
      callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: {
    fileSize: Number(process.env.PYQ_MAX_UPLOAD_BYTES) || 20 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, callback) => {
    if (!isSupportedUpload(file)) {
      callback(new AppError(400, 'Only matching PDF, JPG/JPEG, PNG, and DOCX uploads are supported.'));
      return;
    }
    callback(null, true);
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Upload rate limit reached. Try again later.', data: null },
});
const llmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Analysis rate limit reached. Try again later.', data: null },
});

function requireMongo(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    next(new AppError(503, 'PYQ storage requires an active MongoDB connection.'));
    return;
  }
  next();
}

function userIdOf(req) {
  return String(req.user.id || req.user._id);
}

async function ownedSubject(subjectId, userId) {
  const parsedId = idSchema.parse(subjectId);
  const subject = await Subject.findOne({ _id: parsedId, userId }).lean();
  if (!subject) throw new AppError(404, 'Subject not found.');
  return subject;
}

async function checkFileSignature(file) {
  const extension = path.extname(file.path).toLowerCase();
  const handle = await open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(8);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);
    const valid = extension === '.pdf'
      ? header.subarray(0, 5).toString() === '%PDF-'
      : extension === '.png'
        ? header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : extension === '.jpg' || extension === '.jpeg'
          ? header.length >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255
          : extension === '.docx'
            ? header[0] === 80 && header[1] === 75
            : false;
    if (!valid) throw new AppError(400, 'The uploaded file content does not match its file type.');
  } finally {
    await handle.close();
  }
}

function cleanupTemporaryFiles(files = []) {
  return Promise.all(files.map((file) => rm(file.path, { force: true })));
}

async function applySyllabus(subject, syllabus) {
  const parsed = syllabusInputSchema.parse(syllabus);
  const orders = parsed.units.map((unit) => unit.order);
  if (new Set(orders).size !== orders.length) {
    throw new AppError(400, 'Syllabus unit order values must be unique.');
  }
  for (const unit of parsed.units) {
    const topicNames = unit.topics.map((topic) => topic.name.toLowerCase());
    if (new Set(topicNames).size !== topicNames.length) {
      throw new AppError(400, `Topic names in "${unit.name}" must be unique.`);
    }
  }
  await Promise.all([
    Question.updateMany(
      { subjectId: subject._id },
      { $set: { unitId: null, topicIds: [], mappingConfidence: 0, isUnmapped: true } }
    ),
    Topic.deleteMany({ subjectId: subject._id }),
    TopicStats.deleteMany({ subjectId: subject._id }),
    UnitStats.deleteMany({ subjectId: subject._id }),
  ]);
  await Unit.deleteMany({ subjectId: subject._id });
  for (const unitData of parsed.units) {
    const unit = await Unit.create({
      subjectId: subject._id,
      name: unitData.name,
      order: unitData.order,
      syllabusWeight: unitData.syllabusWeight,
    });
    if (unitData.topics.length) {
      await Topic.insertMany(unitData.topics.map((topic) => ({
topic,
        subjectId: subject._id,
        unitId: unit._id,
      })));
    }
  }
}

function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'AcadLytic PYQ & Syllabus API',
      version: '1.0.0',
      description: 'Authenticated, user-scoped syllabus, past-paper analysis, and practice-paper endpoints.',
    },
    servers: [{ url: '/api/v1' }],
    security: [{ cookieAuth: [] }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'acadlytic_session' },
      },
    },
    paths: {
      '/subjects': {
        get: { summary: 'List current user subjects', responses: { 200: { description: 'Subject list' } } },
        post: { summary: 'Create a subject', responses: { 201: { description: 'Created subject' } } },
      },
      '/subjects/{id}/syllabus': {
        get: { summary: 'Get subject syllabus', responses: { 200: { description: 'Units and topics' } } },
        post: { summary: 'Create or replace a subject syllabus', responses: { 200: { description: 'Saved syllabus' } } },
      },
      '/pyqs/upload': { post: { summary: 'Upload up to 10 past papers', responses: { 202: { description: 'Processing jobs' } } } },
      '/pyqs/jobs/{id}': { get: { summary: 'Get a processing job', responses: { 200: { description: 'Job status' } } } },
      '/pyqs/jobs/{id}/retry': { post: { summary: 'Retry a failed job', responses: { 202: { description: 'Retry queued' } } } },
      '/pyqs': { get: { summary: 'List uploaded papers', responses: { 200: { description: 'Paginated papers' } } } },
      '/pyqs/{id}': {
        get: { summary: 'Get paper and questions', responses: { 200: { description: 'Paper and questions' } } },
        delete: { summary: 'Delete paper and recompute stats', responses: { 200: { description: 'Paper deleted' } } },
      },
      '/questions/{id}': { patch: { summary: 'Manually map or edit a question', responses: { 200: { description: 'Updated question' } } } },
      '/subjects/{id}/analysis': { get: { summary: 'Get subject trends and analysis', responses: { 200: { description: 'Analysis data' } } } },
      '/subjects/{id}/important-topics': { get: { summary: 'Rank important topics', responses: { 200: { description: 'Topic ranking' } } } },
      '/subjects/{id}/syllabus-coverage': { get: { summary: 'Get syllabus coverage', responses: { 200: { description: 'Topic coverage' } } } },
      '/subjects/{id}/unmapped-questions': { get: { summary: 'List unmapped questions', responses: { 200: { description: 'Questions to review' } } } },
      '/subjects/{id}/probable-paper': { post: { summary: 'Generate an estimated practice paper', responses: { 201: { description: 'Practice paper' } } } },
      '/subjects/{id}/probable-papers': { get: { summary: 'List generated practice papers', responses: { 200: { description: 'Practice papers' } } } },
      '/probable-papers/{id}': { get: { summary: 'Get a generated practice paper', responses: { 200: { description: 'Practice paper' } } } },
      '/probable-papers/{id}/export': { get: { summary: 'Export a practice paper to PDF', responses: { 200: { description: 'PDF document' } } } },
      '/me/pyq-data': { delete: { summary: 'Delete current user PYQ data', responses: { 200: { description: 'User data deleted' } } } },
    },
  };
}

router.use(requireFeatureAuth, requireMongo);

router.post('/subjects', asyncHandler(async (req, res) => {
  const input = subjectInputSchema.parse(req.body);
  const subject = await Subject.create({ ...input, userId: userIdOf(req) });
  return sendSuccess(res, 'Subject created.', subject, 201);
}));

router.get('/subjects', asyncHandler(async (req, res) => {
  const subjects = await Subject.find({ userId: userIdOf(req) }).sort({ name: 1 }).lean();
  return sendSuccess(res, 'Subjects loaded.', subjects);
}));

router.post(
  '/subjects/:id/syllabus',
  llmLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const userId = userIdOf(req);
    const subject = await ownedSubject(req.params.id, userId);
    let syllabus = req.body?.units ? req.body : null;
    if (req.file) {
      try {
        await checkFileSignature(req.file);
        const text = await extractText(req.file.path);
        syllabus = await parseSyllabusText(text, userId);
      } finally {
        await cleanupTemporaryFiles([req.file]);
      }
    }
    if (!syllabus) throw new AppError(400, 'Provide syllabus JSON or upload a supported file.');
    await applySyllabus(subject, syllabus);
    return sendSuccess(res, 'Syllabus saved.', await getSyllabus(subject._id));
  })
);

async function getSyllabus(subjectId) {
  const units = await Unit.find({ subjectId }).sort({ order: 1 }).lean();
  const topics = await Topic.find({ subjectId }).sort({ name: 1 }).lean();
  const topicsByUnit = new Map();
  for (const topic of topics) {
    const key = String(topic.unitId);
    const list = topicsByUnit.get(key) || [];
    list.push(topic);
    topicsByUnit.set(key, list);
  }
  return units.map((unit) => ({ ...unit, topics: topicsByUnit.get(String(unit._id)) || [] }));
}

router.get('/subjects/:id/syllabus', asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  return sendSuccess(res, 'Syllabus loaded.', await getSyllabus(subject._id));
}));

router.post('/pyqs/upload', uploadLimiter, upload.array('files', 10), asyncHandler(async (req, res) => {
  const files = req.files || [];
  const created = [];
  const storedPaths = [];
  if (!files.length) throw new AppError(400, 'Select at least one paper to upload.');
  try {
    const userId = userIdOf(req);
    const input = uploadMetadataSchema.parse(req.body);
    const subject = await ownedSubject(input.subjectId, userId);
    await ensureUploadDirectories();

    const uploads = [];
    for (const file of files) {
      await checkFileSignature(file);
      const fileHash = await hashFile(file.path);
      uploads.push({ file, fileHash });
    }
    const existing = await PyqPaper.find({
      userId,
      fileHash: { $in: uploads.map((item) => item.fileHash) },
    }).select('+fileHash').lean();
    assertNoDuplicateHashes(
      uploads.map((item) => item.fileHash),
      existing.map((paper) => paper.fileHash)
    );
    await reserveDailyQuota(userId, 'upload', uploads.length);

    for (const { file, fileHash } of uploads) {
      const fileUrl = await promoteUpload(
        file.path,
        userId,
        fileHash,
        path.extname(file.originalname).toLowerCase()
      );
      storedPaths.push(fileUrl);
      const paper = await PyqPaper.create({
        userId,
        subjectId: subject._id,
        examName: input.examName,
        year: input.year,
        session: input.session,
        totalMarks: input.totalMarks,
        duration: input.duration,
        fileUrl,
        fileHash,
      });
      created.push(paper);
      const job = await PyqJob.create({ userId, paperId: paper._id });
      await PyqPaper.updateOne({ _id: paper._id }, { $set: { jobId: job._id } });
      created[created.length - 1] = { paper, job };
    }
    for (const { job } of created) req.pyqQueue.enqueue(job._id);
    return sendSuccess(
      res,
      'Papers uploaded and queued for analysis.',
      created.map(({ paper, job }) => ({ paperId: paper._id, jobId: job._id, status: job.status })),
      202
    );
  } catch (error) {
    const papers = created.map((item) => item.paper || item);
    const jobs = created.map((item) => item.job).filter(Boolean);
    await Promise.all([
      PyqPaper.deleteMany({ _id: { $in: papers.map((paper) => paper._id) } }),
      PyqJob.deleteMany({ _id: { $in: jobs.map((job) => job._id) } }),
      Promise.all(storedPaths.map((fileUrl) => deleteStoredFile(fileUrl))),
    ]);
    throw error;
  } finally {
    await cleanupTemporaryFiles(files);
  }
}));

router.get('/pyqs/jobs/:id', asyncHandler(async (req, res) => {
  const jobId = idSchema.parse(req.params.id);
  const job = await PyqJob.findOne({ _id: jobId, userId: userIdOf(req) }).lean();
  if (!job) throw new AppError(404, 'Processing job not found.');
  return sendSuccess(res, 'Processing status loaded.', {
    id: job._id,
    paperId: job.paperId,
    status: job.status,
    progress: job.progress,
    failReason: job.failReason,
    attempts: job.attempts,
  });
}));

router.post('/pyqs/jobs/:id/retry', asyncHandler(async (req, res) => {
  const jobId = idSchema.parse(req.params.id);
  const userId = userIdOf(req);
  const job = await PyqJob.findOne({ _id: jobId, userId });
  if (!job) throw new AppError(404, 'Processing job not found.');
  if (job.status !== 'failed') throw new AppError(409, 'Only a failed job can be retried.');
  const paper = await PyqPaper.findOne({ _id: job.paperId, userId });
  if (!paper) throw new AppError(404, 'Uploaded paper not found.');
  await Promise.all([
    PyqJob.updateOne(
      { _id: job._id },
      { $set: { status: 'queued', progress: 0, failReason: '', finishedAt: null } }
    ),
    PyqPaper.updateOne({ _id: paper._id }, { $set: { status: 'queued', progress: 0, failReason: '' } }),
  ]);
  req.pyqQueue.enqueue(job._id);
  return sendSuccess(res, 'Processing retry queued.', { jobId: job._id, status: 'queued' }, 202);
}));

router.get('/pyqs', asyncHandler(async (req, res) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const userId = userIdOf(req);
  const filter = { userId };
  if (req.query.subjectId) {
    const subject = await ownedSubject(req.query.subjectId, userId);
    filter.subjectId = subject._id;
  }
  const [papers, total] = await Promise.all([
    PyqPaper.find(filter)
      .sort({ year: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PyqPaper.countDocuments(filter),
  ]);
  return sendSuccess(res, 'Papers loaded.', { papers, page, limit, total });
}));

router.get('/pyqs/:id', asyncHandler(async (req, res) => {
  const paperId = idSchema.parse(req.params.id);
  const paper = await PyqPaper.findOne({ _id: paperId, userId: userIdOf(req) }).lean();
  if (!paper) throw new AppError(404, 'Paper not found.');
  const questions = await Question.find({ paperId }).sort({ section: 1, number: 1, subPart: 1 }).lean();
  return sendSuccess(res, 'Paper loaded.', { ...paper, questions });
}));

router.delete('/pyqs/:id', asyncHandler(async (req, res) => {
  const paperId = idSchema.parse(req.params.id);
  const paper = await PyqPaper.findOne({ _id: paperId, userId: userIdOf(req) }).select('+fileUrl');
  if (!paper) throw new AppError(404, 'Paper not found.');
  await Promise.all([
    Question.deleteMany({ paperId }),
    PyqJob.deleteMany({ paperId, userId: userIdOf(req) }),
    deleteStoredFile(paper.fileUrl),
  ]);
  await PyqPaper.deleteOne({ _id: paper._id });
  await recomputeSubjectStats(paper.subjectId);
  return sendSuccess(res, 'Paper deleted and statistics updated.', { id: paperId });
}));

router.patch('/questions/:id', asyncHandler(async (req, res) => {
  const questionId = idSchema.parse(req.params.id);
  const patch = questionPatchSchema.parse(req.body);
  const question = await Question.findById(questionId);
  if (!question) throw new AppError(404, 'Question not found.');
  const paper = await PyqPaper.findOne({
    _id: question.paperId,
    userId: userIdOf(req),
  });
  if (!paper) throw new AppError(404, 'Question not found.');
  let unitId = patch.unitId === undefined ? question.unitId : patch.unitId;
  let topicIds = patch.topicIds === undefined ? question.topicIds.map(String) : patch.topicIds;
  if (topicIds.length) {
    const topics = await Topic.find({ _id: { $in: topicIds }, subjectId: question.subjectId }).lean();
    if (topics.length !== topicIds.length) throw new AppError(400, 'Selected topics must belong to this subject.');
    const topicUnitIds = [...new Set(topics.map((topic) => String(topic.unitId)))];
    if (unitId && topicUnitIds.some((id) => id !== String(unitId))) {
      throw new AppError(400, 'Selected topics must belong to the selected unit.');
    }
    if (!unitId) unitId = topics[0].unitId;
  }
  if (unitId && !(await Unit.exists({ _id: unitId, subjectId: question.subjectId }))) {
    throw new AppError(400, 'Selected unit must belong to this subject.');
  }

  if (patch.text !== undefined) question.text = patch.text;
  if (patch.marks !== undefined) question.marks = patch.marks;
  question.unitId = unitId || null;
  question.topicIds = topicIds;
  if (patch.topicIds !== undefined) {
    question.isUnmapped = topicIds.length === 0;
    question.mappingConfidence = topicIds.length ? 1 : 0;
  }
  question.userEdited = true;
  await question.save();
  await recomputeSubjectStats(question.subjectId);
  return sendSuccess(res, 'Question updated and statistics recomputed.', question);
}));

router.get('/subjects/:id/unmapped-questions', asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  const { page, limit } = paginationSchema.parse(req.query);
  const filter = { subjectId: subject._id, isUnmapped: true };
  const [questions, total] = await Promise.all([
    Question.find(filter).sort({ year: -1, number: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Question.countDocuments(filter),
  ]);
  return sendSuccess(res, 'Unmapped questions loaded.', { questions, page, limit, total });
}));

router.get('/subjects/:id/analysis', asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  const [topicStats, unitStats, topicRecords, unitRecords, yearly, types, repeated] = await Promise.all([
    TopicStats.find({ subjectId: subject._id }).sort({ importanceScore: -1 }).lean(),
    UnitStats.find({ subjectId: subject._id }).sort({ importanceScore: -1 }).lean(),
    Topic.find({ subjectId: subject._id }).lean(),
    Unit.find({ subjectId: subject._id }).sort({ order: 1 }).lean(),
    Question.aggregate([
      { $match: { subjectId: subject._id } },
      { $group: { _id: '$year', questions: { $sum: 1 }, marks: { $sum: { $ifNull: ['$marks', 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    Question.aggregate([
      { $match: { subjectId: subject._id } },
      { $group: { _id: '$type', count: { $sum: 1 }, marks: { $sum: { $ifNull: ['$marks', 0] } } } },
      { $sort: { count: -1 } },
    ]),
    Question.find({ subjectId: subject._id, duplicateGroupId: { $ne: '' } })
      .select('text marks year duplicateGroupId topicIds')
      .sort({ year: -1 })
      .limit(1000)
      .lean(),
  ]);
  const topicsById = new Map(topicRecords.map((topic) => [String(topic._id), topic]));
  const unitsById = new Map(unitRecords.map((unit) => [String(unit._id), unit]));
  const byDuplicate = new Map();
  for (const question of repeated) {
    const group = byDuplicate.get(question.duplicateGroupId) || [];
    group.push(question);
    byDuplicate.set(question.duplicateGroupId, group);
  }
  const repeatedQuestions = [...byDuplicate.entries()]
    .filter(([, questions]) => questions.length > 1)
    .map(([groupId, questions]) => ({ groupId, count: questions.length, questions }));
  return sendSuccess(res, 'Subject analysis loaded.', {
    units: unitStats.map((stats) => ({ ...stats, unit: unitsById.get(String(stats.unitId)) || null })),
    topics: topicStats.map((stats) => ({
      ...stats,
      topic: topicsById.get(String(stats.topicId)) || null,
      unit: unitsById.get(String(stats.unitId)) || null,
    })),
    yearly,
    questionTypes: types,
    repeatedQuestions,
    syllabusCoverage: {
      neverAsked: topicRecords.filter((topic) =>
        !topicStats.some((stats) => String(stats.topicId) === String(topic._id) && stats.frequency > 0)
      ),
      covered: topicStats.filter((stats) => stats.frequency > 0)
        .map((stats) => ({ topic: topicsById.get(String(stats.topicId)) || null, stats })),
    },
  });
}));

router.get('/subjects/:id/important-topics', asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  const query = z.object({
    level: z.enum(['high', 'medium', 'low']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);
  const filter = { subjectId: subject._id };
  if (query.level) filter.level = query.level;
  const topics = await TopicStats.find(filter)
    .sort({ importanceScore: -1 })
    .limit(query.limit)
    .populate('topicId', 'name keywords')
    .populate('unitId', 'name order')
    .lean();
  const units = await UnitStats.find({ subjectId: subject._id }).sort({ importanceScore: -1 }).populate('unitId', 'name order').lean();
  return sendSuccess(res, 'Importance rankings loaded.', { units, topics });
}));

router.get('/subjects/:id/syllabus-coverage', asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  const [topics, stats] = await Promise.all([
    Topic.find({ subjectId: subject._id }).populate('unitId', 'name order').lean(),
    TopicStats.find({ subjectId: subject._id }).lean(),
  ]);
  const statsById = new Map(stats.map((item) => [String(item.topicId), item]));
  const coverage = topics.map((topic) => ({
    topic,
    stats: statsById.get(String(topic._id)) || {
      frequency: 0,
      yearsAppeared: [],
      totalMarks: 0,
      marksPercent: 0,
      importanceScore: 0,
      level: 'low',
      reason: 'No uploaded questions have been mapped to this topic.',
    },
  }));
  return sendSuccess(res, 'Syllabus coverage loaded.', {
    neverAsked: coverage.filter(({ stats: item }) => item.frequency === 0),
    covered: coverage.filter(({ stats: item }) => item.frequency > 0),
  });
}));

router.post('/subjects/:id/probable-paper', llmLimiter, asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  const options = probablePaperInputSchema.parse(req.body);
  const paper = await generateProbablePaper(subject._id, userIdOf(req), options);
  return sendSuccess(res, 'Estimated practice paper generated.', paper, 201);
}));

router.get('/subjects/:id/probable-papers', asyncHandler(async (req, res) => {
  const subject = await ownedSubject(req.params.id, userIdOf(req));
  const { page, limit } = paginationSchema.parse(req.query);
  const filter = { subjectId: subject._id, userId: userIdOf(req) };
  const [papers, total] = await Promise.all([
    ProbablePaper.find(filter).sort({ version: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ProbablePaper.countDocuments(filter),
  ]);
  return sendSuccess(res, 'Practice papers loaded.', { papers, page, limit, total });
}));

router.get('/probable-papers/:id', asyncHandler(async (req, res) => {
  const paperId = idSchema.parse(req.params.id);
  const paper = await ProbablePaper.findOne({ _id: paperId, userId: userIdOf(req) }).lean();
  if (!paper) throw new AppError(404, 'Practice paper not found.');
  return sendSuccess(res, 'Practice paper loaded.', paper);
}));

router.get('/probable-papers/:id/export', asyncHandler(async (req, res) => {
  if (req.query.format && req.query.format !== 'pdf') throw new AppError(400, 'Only PDF export is supported.');
  const paperId = idSchema.parse(req.params.id);
  const paper = await ProbablePaper.findOne({ _id: paperId, userId: userIdOf(req) }).lean();
  if (!paper) throw new AppError(404, 'Practice paper not found.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="practice-paper-v${paper.version}.pdf"`);
  const document = new PDFDocument({ margin: 48 });
  document.pipe(res);
  document.fontSize(20).text('Most Probable Practice Paper', { align: 'center' });
  document.moveDown(0.5).fontSize(11)
    .text(`Total marks: ${paper.totalMarks} | Duration: ${paper.duration} minutes`);
  document.moveDown().fontSize(10).fillColor('#555')
    .text('Probability values are estimates based on past trends, not guarantees.');
  document.fillColor('#000');
  for (const section of paper.sections) {
    document.moveDown().fontSize(15).text(section.title);
    for (const [index, question] of section.questions.entries()) {
      document.moveDown(0.5).fontSize(11)
        .text(`${index + 1}. (${question.marks} marks) ${question.text}`);
      if (question.hint) document.fontSize(9).fillColor('#555').text(`Hint: ${question.hint}`).fillColor('#000');
    }
  }
  document.end();
}));

router.delete('/me/pyq-data', asyncHandler(async (req, res) => {
  const userId = userIdOf(req);
  const subjects = await Subject.find({ userId }).select('_id').lean();
  const subjectIds = subjects.map((subject) => subject._id);
  const papers = await PyqPaper.find({ userId }).select('+fileUrl').lean();
  await Promise.all(papers.map((paper) => deleteStoredFile(paper.fileUrl)));
  const paperIds = papers.map((paper) => paper._id);
  await Promise.all([
    Question.deleteMany({ subjectId: { $in: subjectIds } }),
    PyqJob.deleteMany({ userId }),
    PyqPaper.deleteMany({ userId }),
    ProbablePaper.deleteMany({ userId }),
    TopicStats.deleteMany({ subjectId: { $in: subjectIds } }),
    UnitStats.deleteMany({ subjectId: { $in: subjectIds } }),
    Topic.deleteMany({ subjectId: { $in: subjectIds } }),
    Unit.deleteMany({ subjectId: { $in: subjectIds } }),
    Subject.deleteMany({ userId }),
    DailyQuota.deleteMany({ userId }),
  ]);
  return sendSuccess(res, 'Your PYQ and syllabus data has been deleted.', {
    subjects: subjectIds.length,
    papers: paperIds.length,
  });
}));

const openApiSpec = getOpenApiSpec();
router.get('/openapi.json', (req, res) => res.json(openApiSpec));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
router.use(featureErrorHandler);

export default router;
