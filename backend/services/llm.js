import { getGeminiClient, getLlmModel } from './aiClient.js';
import { AppError } from '../utils/http.js';
import { reserveDailyQuota } from './dailyQuota.js';

function stripCodeFence(value) {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export async function generateValidatedJson(
  schema,
  prompt,
  systemInstruction,
  { maxAttempts = 3, userId } = {}
) {
  let currentPrompt = prompt;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    if (userId) await reserveDailyQuota(userId, 'llm');
    try {
      response = await getGeminiClient().models.generateContent({
        model: getLlmModel(),
        contents: [{ role: 'user', parts: [{ text: currentPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          systemInstruction,
        },
      });
    } catch (error) {
      if (!process.env.GEMINI_API_KEY?.trim()) {
        throw new AppError(503, 'Gemini is not configured on the server.');
      }
      const status = Number(error?.status || error?.response?.status);
      if (status === 429) throw new AppError(503, 'Gemini rate limit reached. Retry the job later.');
      throw new AppError(502, 'Gemini could not complete a PYQ analysis step.');
    }

    try {
      const parsed = JSON.parse(stripCodeFence(response.text || ''));
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      lastError = result.error.issues[0]?.message || 'The model output did not match the required schema.';
    } catch (error) {
      lastError = error instanceof SyntaxError
        ? 'The model returned invalid JSON.'
        : error.message;
    }

    currentPrompt = [
      prompt,
      '',
      `The previous response was invalid: ${lastError}`,
      'Return a corrected JSON object only. Do not include markdown fences or commentary.',
    ].join('\n');
  }

  throw new AppError(502, `The generated analysis did not match the required format after ${maxAttempts} attempts.`);
}
