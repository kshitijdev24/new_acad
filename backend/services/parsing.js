import { extractedQuestionsSchema, syllabusInputSchema } from '../validation/pyqSchemas.js';
import { generateValidatedJson } from './llm.js';

const JSON_ONLY = 'Return valid JSON only. Do not wrap the response in markdown.';

export async function parseSyllabusText(rawText, userId, generate = generateValidatedJson) {
  const prompt = [
    'Extract the syllabus into this JSON shape: {"units":[{"name":"Unit name","order":1,"syllabusWeight":1,"topics":[{"name":"Topic name","keywords":["keyword"],"syllabusWeight":1}]}]}.',
    'Include only units and topics explicitly supported by the source. Keep weights between 0 and 1; use 1 when no weight is stated.',
    'Syllabus source:',
    rawText.slice(0, 100000),
  ].join('\n');
  return generate(syllabusInputSchema, prompt, JSON_ONLY, { userId });
}

export async function parseQuestionPaper(rawText, userId, generate = generateValidatedJson) {
  const prompt = [
    'Parse this exam paper into {"questions":[{"number":"1","subPart":"a","section":"Section A","choiceGroupId":"","text":"question text","marks":5,"type":"short","difficulty":"medium"}]}.',
    'Use type mcq, short, long, numerical, or case. Use null for unknown marks and easy, medium, or hard for difficulty.',
    'Represent both alternatives of an OR choice as separate questions and assign the same choiceGroupId to them.',
    'Do not invent unreadable question text, marks, years, or section headings. Exclude instructions that are not questions.',
    'Exam paper text:',
    rawText.slice(0, 120000),
  ].join('\n');
  return generate(extractedQuestionsSchema, prompt, JSON_ONLY, { userId });
}
