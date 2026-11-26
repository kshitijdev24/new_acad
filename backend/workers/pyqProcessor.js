import { randomUUID } from 'crypto';
import { PyqJob, PyqPaper, Question, Topic, Unit } from '../models.js';
import { cosineSimilarity } from '../services/embeddings.js';
import { extractText } from '../services/extractText.js';
import { mapQuestionsToTopics } from '../services/topicMapping.js';
import { parseQuestionPaper } from '../services/parsing.js';
import { recomputeSubjectStats } from '../services/recomputeStats.js';
import { DUPLICATE_SIMILARITY_THRESHOLD } from '../config/scoring.js';
import { resolveStoredFile } from '../storage/localStorage.js';

async function setStage(paper, job, status, progress) {
  const jobUpdate = { $set: { status, progress, failReason: '' } };
  if (status === 'extracting') {
    jobUpdate.$set.startedAt = new Date();
    jobUpdate.$inc = { attempts: 1 };
  }
  await Promise.all([
    PyqPaper.updateOne(
      { _id: paper._id },
      {
        $set: { status, progress, failReason: '' },
        ...(status === 'extracting' ? { $inc: { attempts: 1 } } : {}),
      }
    ),
    PyqJob.updateOne({ _id: job._id }, jobUpdate),
  ]);
}

async function assignDuplicateGroups(questions, subjectId) {
  const previous = await Question.find({ subjectId })
    .select('+embedding duplicateGroupId')
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();
  const comparison = previous.map((question) => ({
    id: question._id,
    question: null,
    embedding: question.embedding || [],
    duplicateGroupId: question.duplicateGroupId || '',
  }));
  const updates = [];

  for (const question of questions) {
    let match = null;
    for (const candidate of comparison) {
      if (!candidate.embedding.length) continue;
      if (cosineSimilarity(question.embedding, candidate.embedding) > DUPLICATE_SIMILARITY_THRESHOLD) {
        match = candidate;
        break;
      }
    }
    if (match) {
      if (!match.duplicateGroupId) {
        match.duplicateGroupId = randomUUID();
        if (match.question) {
          match.question.duplicateGroupId = match.duplicateGroupId;
        } else if (match.id) {
          updates.push(Question.updateOne(
            { _id: match.id },
            { $set: { duplicateGroupId: match.duplicateGroupId } }
          ));
        }
      }
      question.duplicateGroupId = match.duplicateGroupId;
    }
    comparison.unshift({
      id: null,
      question,
      embedding: question.embedding,
      duplicateGroupId: question.duplicateGroupId || '',
    });
  }
  await Promise.all(updates);
}

export async function processPyqJob(jobId) {
  let job;
  let paper;
  try {
    job = await PyqJob.findById(jobId);
    if (!job) return;
    paper = await PyqPaper.findOne({
      _id: job.paperId,
      userId: job.userId,
    }).select('+fileUrl +rawText');
    if (!paper) throw new Error('The uploaded paper record could not be found.');

    await setStage(paper, job, 'extracting', 10);
    const rawText = await extractText(resolveStoredFile(paper.fileUrl));
    await PyqPaper.updateOne({ _id: paper._id }, { $set: { rawText } });

    await setStage(paper, job, 'parsing', 35);
    const parsed = await parseQuestionPaper(rawText, job.userId);
    await Question.deleteMany({ paperId: paper._id });

    await setStage(paper, job, 'mapping', 65);
    const [units, topics] = await Promise.all([
      Unit.find({ subjectId: paper.subjectId }).lean(),
      Topic.find({ subjectId: paper.subjectId }).select('+embedding').lean(),
    ]);
    const mapped = await mapQuestionsToTopics(parsed.questions, topics, units, job.userId);
    const questions = mapped.map((item) => ({
      paperId: paper._id,
      subjectId: paper.subjectId,
      year: paper.year,
      number: item.question.number,
      subPart: item.question.subPart || '',
      section: item.question.section || '',
      choiceGroupId: item.question.choiceGroupId || '',
      text: item.question.text,
      marks: item.question.marks ?? undefined,
      type: item.question.type,
      unitId: item.unitId,
      topicIds: item.topicId ? [item.topicId] : [],
      mappingConfidence: item.confidence,
      isUnmapped: item.isUnmapped,
      difficulty: item.question.difficulty,
      embedding: item.embedding,
    }));
    await assignDuplicateGroups(questions, paper.subjectId);
    if (questions.length) await Question.insertMany(questions, { ordered: true });

    await recomputeSubjectStats(paper.subjectId);
    await Promise.all([
      PyqPaper.updateOne({ _id: paper._id }, { $set: { status: 'done', progress: 100, failReason: '' } }),
      PyqJob.updateOne(
        { _id: job._id },
        { $set: { status: 'done', progress: 100, failReason: '', finishedAt: new Date() } }
      ),
    ]);
  } catch (error) {
    if (!job) throw error;
    const failReason = String(error?.message || 'The paper could not be processed.')
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 1000);
    const updates = [];
    if (paper) {
      updates.push(PyqPaper.updateOne(
        { _id: paper._id },
        { $set: { status: 'failed', failReason } }
      ));
    }
    if (job) {
      updates.push(PyqJob.updateOne(
        { _id: job._id },
        { $set: { status: 'failed', failReason, finishedAt: new Date() } }
      ));
    }
    await Promise.all(updates);
  }
}
