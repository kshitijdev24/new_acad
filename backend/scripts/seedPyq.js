import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import {
  PyqPaper,
  Question,
  Subject,
  Topic,
  Unit,
  User,
} from '../models.js';
import { recomputeSubjectStats } from '../services/recomputeStats.js';
import {
  ensureUploadDirectories,
  hashFile,
  promoteUpload,
  getTemporaryDirectory,
  temporaryFileName,
} from '../storage/localStorage.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const userId = process.env.PYQ_SEED_USER_ID;
if (!process.env.MONGODB_URI || !userId) {
  throw new Error('Set MONGODB_URI and PYQ_SEED_USER_ID to seed sample PYQ data.');
}

function writeSamplePdf(filePath, year, questions) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument();
    const stream = createWriteStream(filePath);
    stream.once('finish', resolve);
    stream.once('error', reject);
    document.pipe(stream);
    document.fontSize(18).text(`Sample Computer Science Examination ${year}`);
    document.moveDown();
    document.fontSize(12).text('Section A');
    for (const question of questions) {
      document.moveDown(0.5).text(`${question.number}. ${question.text} (${question.marks} marks)`);
    }
    document.end();
  });
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ id: userId }).select('id');
  if (!user) throw new Error('PYQ_SEED_USER_ID must match an existing account id.');
  await ensureUploadDirectories();

  const subject = await Subject.findOneAndUpdate(
    { userId, code: 'PYQDEMO' },
    { $setOnInsert: { userId, code: 'PYQDEMO', name: 'Sample Computer Science' } },
    { upsert: true, new: true }
  );
  const syllabus = [
    {
      name: 'Data Structures',
      order: 1,
      topics: [
        { name: 'Binary Search Trees', keywords: ['BST', 'tree traversal'] },
        { name: 'Graph Traversal', keywords: ['BFS', 'DFS', 'graph'] },
      ],
    },
    {
      name: 'Algorithms',
      order: 2,
      topics: [
        { name: 'Sorting Algorithms', keywords: ['merge sort', 'quick sort'] },
        { name: 'Dynamic Programming', keywords: ['memoization', 'optimal substructure'] },
      ],
    },
    {
      name: 'Operating Systems',
      order: 3,
      topics: [
        { name: 'Process Scheduling', keywords: ['CPU scheduling', 'round robin'] },
        { name: 'Memory Management', keywords: ['paging', 'virtual memory'] },
      ],
    },
  ];
  const units = [];
  for (const unitData of syllabus) {
    let unit = await Unit.findOne({ subjectId: subject._id, order: unitData.order });
    if (!unit) unit = await Unit.create({ ...unitData, subjectId: subject._id });
    units.push(unit);
    for (const topicData of unitData.topics) {
      await Topic.updateOne(
        { subjectId: subject._id, unitId: unit._id, name: topicData.name },
        { $setOnInsert: { ...topicData, subjectId: subject._id, unitId: unit._id } },
        { upsert: true }
      );
    }
  }
  const topics = await Topic.find({ subjectId: subject._id }).lean();
  const topicByName = new Map(topics.map((topic) => [topic.name, topic]));
  const samples = [
    {
      year: 2022,
      questions: [
        { number: '1', text: 'Explain insertion and search in a binary search tree.', marks: 10, topic: 'Binary Search Trees' },
        { number: '2', text: 'Compare merge sort and quick sort.', marks: 10, topic: 'Sorting Algorithms' },
        { number: '3', text: 'Describe round-robin process scheduling.', marks: 5, topic: 'Process Scheduling' },
      ],
    },
    {
      year: 2023,
      questions: [
        { number: '1', text: 'Describe in-order and post-order traversal of a binary search tree.', marks: 10, topic: 'Binary Search Trees' },
        { number: '2', text: 'Explain dynamic programming with an example.', marks: 10, topic: 'Dynamic Programming' },
        { number: '3', text: 'Explain paging in virtual memory.', marks: 5, topic: 'Memory Management' },
      ],
    },
    {
      year: 2024,
      questions: [
        { number: '1', text: 'Construct a binary search tree and show its traversal.', marks: 10, topic: 'Binary Search Trees' },
        { number: '2', text: 'Compare breadth-first search and depth-first search.', marks: 10, topic: 'Graph Traversal' },
        { number: '3', text: 'Discuss CPU scheduling criteria and algorithms.', marks: 5, topic: 'Process Scheduling' },
      ],
    },
  ];

  for (const sample of samples) {
    const existing = await PyqPaper.findOne({
      userId,
      subjectId: subject._id,
      year: sample.year,
      examName: 'Sample End Semester Examination',
    });
    if (existing) continue;

    const temporaryPath = path.join(getTemporaryDirectory(), `${temporaryFileName()}.pdf`);
    await writeSamplePdf(temporaryPath, sample.year, sample.questions);
    const fileHash = await hashFile(temporaryPath);
    const fileUrl = await promoteUpload(temporaryPath, userId, fileHash, '.pdf');
    const paper = await PyqPaper.create({
      userId,
      subjectId: subject._id,
      examName: 'Sample End Semester Examination',
      year: sample.year,
      totalMarks: 100,
      duration: 180,
      fileUrl,
      fileHash,
      status: 'done',
      progress: 100,
    });
    await Question.insertMany(sample.questions.map((question) => {
      const topic = topicByName.get(question.topic);
      return {
        paperId: paper._id,
        subjectId: subject._id,
        year: sample.year,
        number: question.number,
        section: 'Section A',
        text: question.text,
        marks: question.marks,
        type: 'long',
        unitId: topic.unitId,
        topicIds: [topic._id],
        mappingConfidence: 1,
        isUnmapped: false,
      };
    }));
  }
  await recomputeSubjectStats(subject._id);
  console.log(`Seeded sample syllabus and three past papers for ${userId}.`);
} finally {
  await mongoose.disconnect();
}
