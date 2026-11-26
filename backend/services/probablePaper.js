import { z } from 'zod';
import {
  ProbablePaper,
  PyqPaper,
  Question,
  Topic,
  TopicStats,
  Unit,
  UnitStats,
} from '../models.js';
import { generateValidatedJson } from './llm.js';
import { AppError } from '../utils/http.js';

const questionTypes = ['mcq', 'short', 'long', 'numerical', 'case'];

function uniquePatternQuestions(questions) {
  const seenChoices = new Set();
  return questions.filter((question) => {
    if (!question.choiceGroupId) return true;
    if (seenChoices.has(question.choiceGroupId)) return false;
    seenChoices.add(question.choiceGroupId);
    return true;
  });
}

function sectionPatterns(questions) {
  const groups = new Map();
  for (const question of uniquePatternQuestions(questions)) {
    const title = question.section || 'Section A';
    const group = groups.get(title) || [];
    if (Number.isInteger(Number(question.marks)) && Number(question.marks) > 0) {
      group.push({
        marks: Number(question.marks),
        type: question.type || 'long',
      });
    }
    groups.set(title, group);
  }
  const sections = [...groups].map(([title, slots]) => ({ title, slots })).filter((section) => section.slots.length);
  return sections.length ? sections : [{ title: 'Section A', slots: [{ marks: 10, type: 'long' }] }];
}

function marksForSections(totalMarks, sections) {
  const sectionWeights = sections.map((section) =>
    section.slots.reduce((sum, slot) => sum + slot.marks, 0)
  );
  const weightTotal = sectionWeights.reduce((sum, weight) => sum + weight, 0);
  const raw = sectionWeights.map((weight) => totalMarks * weight / weightTotal);
  const allocations = raw.map(Math.floor);
  let remainder = totalMarks - allocations.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - allocations[index] }))
    .sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; index < remainder; index += 1) {
    allocations[order[index % order.length].index] += 1;
  }
  return allocations;
}

function makeMarksSlots(total, patternSlots) {
  const marks = patternSlots.map((slot) => slot.marks)
    .filter((value) => Number.isInteger(value) && value > 0);
  const frequency = new Map();
  for (const mark of marks) frequency.set(mark, (frequency.get(mark) || 0) + 1);
  const coins = [...frequency.keys()].sort((left, right) =>
    frequency.get(right) - frequency.get(left) || right - left
  );
  if (!coins.length) coins.push(10, 5, 2, 1);
  const patternTotal = marks.reduce((sum, value) => sum + value, 0) || 1;
  const targetCount = Math.max(1, Math.round(total * marks.length / patternTotal));

  function solve(availableCoins) {
    const maxQuestions = Math.floor(total / Math.min(...availableCoins));
    const width = maxQuestions + 1;
    const reachable = new Uint8Array((total + 1) * width);
    const previousMark = new Uint16Array((total + 1) * width);
    reachable[0] = 1;

    for (let value = 0; value <= total; value += 1) {
      for (let count = 0; count < maxQuestions; count += 1) {
        const stateIndex = value * width + count;
        if (!reachable[stateIndex]) continue;
        for (const coin of availableCoins) {
          if (value + coin > total) continue;
          const nextIndex = (value + coin) * width + count + 1;
          if (!reachable[nextIndex]) {
            reachable[nextIndex] = 1;
            previousMark[nextIndex] = coin;
          }
        }
      }
    }

    let questionCount = -1;
    for (let count = 1; count <= maxQuestions; count += 1) {
      if (!reachable[total * width + count]) continue;
      if (
        questionCount < 0 ||
        Math.abs(count - targetCount) < Math.abs(questionCount - targetCount)
      ) questionCount = count;
    }
    if (questionCount < 0) return null;

    const result = [];
    let remaining = total;
    while (remaining > 0 && questionCount > 0) {
      const coin = previousMark[remaining * width + questionCount];
      if (!coin) return null;
      result.push(coin);
      remaining -= coin;
      questionCount -= 1;
    }
    return remaining === 0 ? result : null;
  }

  const result = solve(coins);
  if (result) return result;
  if (!coins.includes(1)) return solve([...coins, 1]);
  throw new AppError(422, 'The requested marks cannot be allocated to paper questions.');
}

export function buildPaperSlots(totalMarks, questions) {
  if (!Number.isInteger(totalMarks) || totalMarks < 1) {
    throw new AppError(400, 'Total marks must be a positive whole number.');
  }
  const patterns = sectionPatterns(questions);
  const allocations = marksForSections(totalMarks, patterns);
  return patterns.flatMap((section, index) => {
    const allocated = allocations[index];
    if (!allocated) return [];
    const marks = makeMarksSlots(allocated, section.slots);
    const typeUse = new Map();
    return marks.map((value) => {
      const matching = section.slots.filter((slot) => slot.marks === value);
      const typeOptions = matching.length ? matching : section.slots;
      const typeCounts = new Map();
      for (const slot of typeOptions) typeCounts.set(slot.type, (typeCounts.get(slot.type) || 0) + 1);
      const type = [...typeCounts.keys()].sort((left, right) =>
        (typeUse.get(left) || 0) - (typeUse.get(right) || 0)
      )[0] || 'long';
      typeUse.set(type, (typeUse.get(type) || 0) + 1);
      return { section: section.title, marks: value, type };
    });
  });
}

function weightedPick(entries, getWeight) {
  const weights = entries.map((entry) => Math.max(0.01, getWeight(entry)));
  const target = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let running = 0;
  for (let index = 0; index < entries.length; index += 1) {
    running += weights[index];
    if (target <= running) return entries[index];
  }
  return entries[entries.length - 1];
}

function selectSlotTopics(slots, units, topics, topicStats, unitStats, latestYear) {
  const statsByTopic = new Map(topicStats.map((stats) => [String(stats.topicId), stats]));
  const statsByUnit = new Map(unitStats.map((stats) => [String(stats.unitId), stats]));
  const topicsByUnit = new Map();
  for (const topic of topics) {
    const list = topicsByUnit.get(String(topic.unitId)) || [];
    list.push(topic);
    topicsByUnit.set(String(topic.unitId), list);
  }
  const highUnits = units
    .filter((unit) => statsByUnit.get(String(unit._id))?.level === 'high')
    .sort((left, right) =>
      (statsByUnit.get(String(right._id))?.importanceScore || 0) -
      (statsByUnit.get(String(left._id))?.importanceScore || 0)
    );
  const usedHighUnits = new Set();
  const topicUse = new Map();
  const topicCap = Math.max(1, Math.ceil(slots.length * 0.25));
  return slots.map((slot) => {
    const requiredUnit = highUnits.find((unit) => !usedHighUnits.has(String(unit._id)));
    let selectedUnit = requiredUnit;
    if (!selectedUnit) {
      const availableUnits = units.filter((unit) => (topicsByUnit.get(String(unit._id)) || []).length);
      selectedUnit = weightedPick(availableUnits, (unit) =>
        (statsByUnit.get(String(unit._id))?.importanceScore || 1) + 1
      );
    }
    if (!selectedUnit) return { ...slot, unit: null, topic: null, stats: null };
    usedHighUnits.add(String(selectedUnit._id));

    const unitTopics = topicsByUnit.get(String(selectedUnit._id)) || [];
    const eligible = unitTopics.filter((topic) => {
      const stats = statsByTopic.get(String(topic._id));
      return (topicUse.get(String(topic._id)) || 0) < topicCap &&
        (!stats?.yearsAppeared?.includes(latestYear) || stats.tags?.includes('Due Soon'));
    });
    const uncappedTopics = unitTopics.filter((topic) =>
      (topicUse.get(String(topic._id)) || 0) < topicCap
    );
    const candidates = eligible.length
      ? eligible
      : uncappedTopics.length
        ? uncappedTopics
        : unitTopics;
    const topic = candidates.length
      ? weightedPick(candidates, (candidate) =>
        (statsByTopic.get(String(candidate._id))?.importanceScore || 1) + 1
      )
      : null;
    if (topic) {
      const topicId = String(topic._id);
      topicUse.set(topicId, (topicUse.get(topicId) || 0) + 1);
    }
    return {
      ...slot,
      unit: selectedUnit,
      topic,
      stats: topic ? statsByTopic.get(String(topic._id)) || null : null,
    };
  });
}

const generatedQuestionSchema = z.object({
  questions: z.array(z.object({
    index: z.number().int().min(0),
    text: z.string().trim().min(5).max(10000),
    hint: z.string().trim().max(2000),
  })),
});

export async function generateProbablePaper(subjectId, userId, options, generate = generateValidatedJson) {
  const patternPaper = options.patternFromPaperId
    ? await PyqPaper.findOne({
      _id: options.patternFromPaperId,
      subjectId,
      userId,
      status: 'done',
    })
    : await PyqPaper.findOne({ subjectId, userId, status: 'done' }).sort({ year: -1, createdAt: -1 });
  if (!patternPaper) {
    throw new AppError(422, 'Upload and process a past paper before generating a probable paper.');
  }

  const patternQuestions = await Question.find({ paperId: patternPaper._id })
    .select('section marks type choiceGroupId')
    .lean();
  const slots = buildPaperSlots(options.totalMarks, patternQuestions);
  const [units, topics, topicStats, unitStats] = await Promise.all([
    Unit.find({ subjectId }).sort({ order: 1 }).lean(),
    Topic.find({ subjectId }).lean(),
    TopicStats.find({ subjectId }).lean(),
    UnitStats.find({ subjectId }).lean(),
  ]);
  if (!topics.length || !units.length) {
    throw new AppError(422, 'Add a syllabus with units and topics before generating a probable paper.');
  }
  const highUnitCount = unitStats.filter((stats) => stats.level === 'high').length;
  if (highUnitCount > slots.length) {
    throw new AppError(422, 'Increase total marks to create enough questions to cover every high-importance unit.');
  }

  const assignedSlots = selectSlotTopics(
    slots,
    units,
    topics,
    topicStats,
    unitStats,
    patternPaper.year
  );
  const promptSlots = assignedSlots.map((slot, index) => ({
    index,
    section: slot.section,
    marks: slot.marks,
    type: questionTypes.includes(slot.type) ? slot.type : 'long',
    unit: slot.unit?.name || 'General syllabus',
    topic: slot.topic?.name || 'A suitable topic from this unit',
    difficulty: options.difficulty,
  }));
  const outputSchema = generatedQuestionSchema.extend({
    questions: generatedQuestionSchema.shape.questions.length(assignedSlots.length),
  });
  const generated = await generate(
    outputSchema,
    [
      'Write original exam-style questions for this practice paper. Provide a concise answer hint for each.',
      'Use every slot index exactly once. Preserve the requested section, marks, type, topic, and difficulty. Do not copy any past-paper question verbatim.',
      `Slots: ${JSON.stringify(promptSlots)}`,
      'Return {"questions":[{"index":0,"text":"...","hint":"..."}]}.',
    ].join('\n'),
    'You write original exam practice questions. Output only valid JSON.',
    { userId }
  );
  const byIndex = new Map(generated.questions.map((question) => [question.index, question]));
  if (byIndex.size !== slots.length || slots.some((_, index) => !byIndex.has(index))) {
    throw new AppError(502, 'The question generator did not return every requested paper question.');
  }

  const sections = [];
  for (let index = 0; index < assignedSlots.length; index += 1) {
    const slot = assignedSlots[index];
    const section = sections.find((item) => item.title === slot.section) ||
      { title: slot.section, questions: [] };
    if (!sections.includes(section)) sections.push(section);
    const score = slot.stats?.importanceScore || 0;
    const frequencyScore = topicStats.length
      ? (slot.stats?.frequency || 0) / Math.max(1, ...topicStats.map((item) => item.frequency))
      : 0;
    section.questions.push({
      text: byIndex.get(index).text,
      marks: slot.marks,
      type: questionTypes.includes(slot.type) ? slot.type : 'long',
      unitId: slot.unit?._id,
      topicId: slot.topic?._id,
      probability: Math.round(Math.min(99, Math.max(1, score * 0.7 + frequencyScore * 30))),
      reason: slot.stats?.reason || 'Estimated from the latest paper pattern and syllabus coverage.',
      hint: byIndex.get(index).hint,
    });
  }
  const actualTotal = sections.flatMap((section) => section.questions)
    .reduce((sum, question) => sum + question.marks, 0);
  if (actualTotal !== options.totalMarks) {
    throw new AppError(500, 'Generated paper did not match the requested total marks.');
  }

  const latest = await ProbablePaper.findOne({ subjectId, userId }).sort({ version: -1 });
  return ProbablePaper.create({
    userId,
    subjectId,
    version: (latest?.version || 0) + 1,
    options: { ...options, estimateNotice: 'Probabilities are estimates based on past trends, not guarantees.' },
    totalMarks: options.totalMarks,
    duration: options.duration,
    sections,
  });
}
