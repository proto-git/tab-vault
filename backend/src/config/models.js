// Available AI Models Configuration
// Defines models available through OpenRouter for AI processing

export const MODELS = {
  'claude-haiku': {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    description: 'Fast and efficient, great for most tasks',
    speed: 'fast',
    quality: 'good',
    costPer1kInput: 0.001,   // $1 per million = $0.001 per 1k
    costPer1kOutput: 0.005,  // $5 per million = $0.005 per 1k
    maxTokens: 500,
    temperature: 0.3,
  },
  'claude-sonnet': {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    description: 'Balanced performance and quality',
    speed: 'medium',
    quality: 'excellent',
    costPer1kInput: 0.003,   // $3 per million
    costPer1kOutput: 0.015,  // $15 per million
    maxTokens: 500,
    temperature: 0.3,
  },
  'gpt-4o-mini': {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Fast and affordable OpenAI option',
    speed: 'fast',
    quality: 'good',
    costPer1kInput: 0.00015,  // $0.15 per million
    costPer1kOutput: 0.0006,  // $0.60 per million
    maxTokens: 500,
    temperature: 0.3,
  },
};

// Default model key
export const DEFAULT_MODEL = 'claude-haiku';

/**
 * Get model config by key
 * @param {string} key - Model key (e.g., 'claude-haiku')
 * @returns {Object} Model configuration
 */
export function getModelConfig(key) {
  return MODELS[key] || MODELS[DEFAULT_MODEL];
}

/**
 * Get all models for display
 * @returns {Array} Array of model info for UI
 */
export function getAvailableModels() {
  return Object.entries(MODELS).map(([key, model]) => ({
    key,
    name: model.name,
    provider: model.provider,
    description: model.description,
    speed: model.speed,
    quality: model.quality,
    estimatedCostPerCapture: estimateCaptureCoast(model),
  }));
}

/**
 * Estimate cost per capture for a model
 * Assumes ~1000 input tokens and ~200 output tokens per AI call, 3 calls total
 */
function estimateCaptureCoast(model) {
  const inputTokens = 1000 * 3;  // 3 calls
  const outputTokens = 200 * 3;
  const cost = (inputTokens / 1000 * model.costPer1kInput) +
               (outputTokens / 1000 * model.costPer1kOutput);
  return `~$${cost.toFixed(4)}`;
}
