import { GoogleGenAI } from '@google/genai';

let client;

export function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('Gemini is not configured on the server.');
  }
  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return client;
}

export const getLlmModel = () => process.env.LLM_MODEL || 'gemini-3.8-flash';
export const getEmbeddingModel = () =>
  process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
