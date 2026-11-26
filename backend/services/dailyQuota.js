import { DailyQuota } from '../models.js';
import { AppError } from '../utils/http.js';

const utcDay = () => new Date().toISOString().slice(0, 10);

export async function reserveDailyQuota(userId, kind, amount = 1) {
  const field = kind === 'upload'
    ? 'uploads'
    : kind === 'embedding'
      ? 'embeddingCalls'
      : 'llmCalls';
  const limit = Number(
    kind === 'upload'
      ? process.env.PYQ_DAILY_UPLOAD_QUOTA || 10
      : kind === 'embedding'
        ? process.env.PYQ_DAILY_EMBEDDING_QUOTA || 500
        : process.env.PYQ_DAILY_LLM_QUOTA || 30
  );
  if (!Number.isInteger(amount) || amount < 1 || amount > limit) {
    throw new AppError(429, `Daily ${kind} limit reached. Try again tomorrow.`);
  }
  const query = { userId: String(userId), day: utcDay() };

  try {
    await DailyQuota.updateOne(query, {
      $setOnInsert: { ...query, uploads: 0, llmCalls: 0, embeddingCalls: 0 },
    }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  await DailyQuota.updateOne(
    { ...query, [field]: { $exists: false } },
    { $set: { [field]: 0 } }
  );
  const updated = await DailyQuota.findOneAndUpdate(
    { ...query, [field]: { $lte: limit - amount } },
    { $inc: { [field]: amount } },
    { new: true }
  );
  if (!updated) {
    throw new AppError(429, `Daily ${kind} limit reached. Try again tomorrow.`);
  }
  return updated[field];
}
