import { createHash } from 'crypto';
import { EmbeddingCache } from '../models.js';
import { getEmbeddingModel, getGeminiClient } from './aiClient.js';
import { AppError } from '../utils/http.js';
import { reserveDailyQuota } from './dailyQuota.js';

export function cosineSimilarity(left = [], right = []) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export async function embedText(text, userId) {
  const normalized = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!normalized) throw new AppError(400, 'Cannot create an embedding for empty text.');

  const model = getEmbeddingModel();
  const contentHash = createHash('sha256').update(normalized).digest('hex');
  const cached = await EmbeddingCache.findOne({ contentHash, model }).select('+values').lean();
  if (cached?.values?.length) return cached.values;

  if (userId) await reserveDailyQuota(userId, 'embedding');
  let response;
  try {
    response = await getGeminiClient().models.embedContent({
      model,
      contents: normalized.slice(0, 8000),
    });
  } catch {
    throw new AppError(502, 'The embedding service could not process a question or topic.');
  }

  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || !values.length || values.some((value) => !Number.isFinite(value))) {
    throw new AppError(502, 'The embedding service returned an invalid vector.');
  }
  try {
    await EmbeddingCache.updateOne(
      { contentHash, model },
      { $setOnInsert: { contentHash, model, values } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  return values;
}
