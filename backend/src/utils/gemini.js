async function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.code = 'GEMINI_MISSING';
    throw err;
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  return new GoogleGenerativeAI(key);
}

function candidateModels(preferred) {
  const primary = preferred || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const fallbacks = [
    primary,
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ];
  return [...new Set(fallbacks.filter(Boolean))];
}

/**
 * Generate content with automatic model fallbacks on 404/503.
 */
async function generateGeminiContent(parts, options = {}) {
  const genAI = await getGeminiClient();
  const models = candidateModels(options.modelName);
  let lastError = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(parts);
      return { result, modelName };
    } catch (err) {
      lastError = err;
      const msg = String(err.message || '');
      const retryable =
        msg.includes('[404') ||
        msg.includes('[503') ||
        msg.includes('no longer available') ||
        msg.includes('high demand') ||
        msg.includes('Not Found');
      console.error(`Gemini model ${modelName} failed: ${msg}`);
      if (!retryable) throw err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

async function getGeminiModel(modelName) {
  const genAI = await getGeminiClient();
  const resolved = modelName || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  return genAI.getGenerativeModel({ model: resolved });
}

function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

module.exports = { getGeminiModel, generateGeminiContent, isGeminiConfigured };
