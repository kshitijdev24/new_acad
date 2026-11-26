import { z } from 'zod';
import { Topic } from '../models.js';
import { DEFAULT_MAPPING_THRESHOLD } from '../config/scoring.js';
import { cosineSimilarity, embedText } from './embeddings.js';
import { generateValidatedJson } from './llm.js';
import { mappingOutputSchema } from '../validation/pyqSchemas.js';

export async function mapQuestionsToTopics(
  questions,
  topics,
  units,
  userId,
  generate = generateValidatedJson
) {
  const unitNames = new Map(units.map((unit) => [String(unit._id), unit.name]));
  const topicEmbeddings = await Promise.all(topics.map(async (topic) => {
    let values = topic.embedding?.length
      ? [...topic.embedding]
      : await embedText(
        `${unitNames.get(String(topic.unitId)) || ''}: ${topic.name}. ${topic.keywords.join('. ')}`,
        userId
      );
    if (!topic.embedding?.length) {
      await Topic.updateOne({ _id: topic._id }, { $set: { embedding: values } });
      topic.embedding = values;
    }
    return { topic, values };
  }));
  const prepared = [];

  for (const question of questions) {
    const vector = question.embedding?.length
      ? [...question.embedding]
      : await embedText(question.text, userId);
    const candidates = topicEmbeddings
      .map(({ topic, values }) => ({
        topicId: String(topic._id),
        unitId: String(topic.unitId),
        unitName: unitNames.get(String(topic.unitId)) || '',
        name: topic.name,
        similarity: cosineSimilarity(vector, values),
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 5);
    prepared.push({ question, vector, candidates });
  }

  if (!topics.length) {
    return prepared.map(({ question, vector }) => ({
      question,
      embedding: vector,
      topicId: null,
      unitId: null,
      confidence: 0,
      isUnmapped: true,
    }));
  }

  const threshold = Number(process.env.PYQ_MAPPING_THRESHOLD) || DEFAULT_MAPPING_THRESHOLD;
  const mappings = new Map();
  for (let offset = 0; offset < prepared.length; offset += 10) {
    const batch = prepared.slice(offset, offset + 10);
    const schema = mappingOutputSchema.extend({
      mappings: mappingOutputSchema.shape.mappings.length(batch.length),
    }).superRefine((output, context) => {
      const indices = new Set();
      for (const mapping of output.mappings) {
        if (mapping.index < offset || mapping.index >= offset + batch.length || indices.has(mapping.index)) {
          context.addIssue({ code: 'custom', message: 'Mapping indices must be unique and match the supplied question batch.' });
        }
        indices.add(mapping.index);
      }
    });
    const prompt = [
      'Map each question to its single best candidate syllabus topic, or null if none is a good match.',
      'Only select topic IDs present in that question’s candidate list. Confidence must be from 0 to 1 and reflect semantic fit, not probability of an exam appearance.',
      `Questions and top candidates: ${JSON.stringify(batch.map(({ question, candidates }, batchIndex) => ({
        index: offset + batchIndex,
        number: question.number,
        subPart: question.subPart || '',
        text: question.text,
        candidates,
      })))}`,
      'Return {"mappings":[{"index":0,"topicId":"24-character-topic-id-or-null","confidence":0.8}]}',
    ].join('\n');
    const result = await generate(
      schema,
      prompt,
      'You map exam questions to supplied syllabus topics. Never invent topic IDs.',
      { userId }
    );
    for (const mapping of result.mappings) {
      mappings.set(mapping.index, mapping);
    }
  }

  return prepared.map(({ question, vector, candidates }, index) => {
    const mapping = mappings.get(index);
    const selected = mapping && candidates.find((candidate) => candidate.topicId === mapping.topicId);
    const confidence = selected ? mapping.confidence : 0;
    const isUnmapped = !selected || confidence < threshold;
    return {
      question,
      embedding: vector,
      topicId: isUnmapped ? null : selected.topicId,
      unitId: isUnmapped ? null : selected.unitId,
      confidence,
      isUnmapped,
    };
  });
}
