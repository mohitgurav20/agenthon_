/**
 * ============================================================
 * AGENT ZERO — MULTI-MODEL ROUTER
 * ============================================================
 * Routes tasks to the optimal LLM based on task type.
 * Supports dynamic runtime LLM switching per agent.
 * Automatically logs token usage and costs to the Auditor service.
 * ============================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const agentsConfig = require('./config/agents.json');
const { logUsage } = require('./services/auditor');

// Model configurations
const MODELS = {
  fast: {
    name: 'groq-llama',
    provider: 'groq',
    model: 'llama-3.1-70b-versatile',
    description: 'Ultra-fast routing, classification, simple tasks',
    maxTokens: 1024
  },
  deep: {
    name: 'gemini-pro',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    description: 'Complex reasoning, analysis, multi-step planning',
    maxTokens: 4096
  },
  flash: {
    name: 'gemini-flash',
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    description: 'Quick summaries, search result processing',
    maxTokens: 2048
  },
  validation: {
    name: 'claude-validation',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    description: 'Strict response validation and quality check',
    maxTokens: 1024
  }
};

// Dynamic in-memory routing table for LLM Switcher UI
let dynamicModels = {
  router: 'fast',       // default to fast (groq-llama)
  research: 'flash',    // default to flash (gemini-flash)
  action: 'deep',       // default to deep (gemini-pro)
  validator: 'validation' // default to validation (claude-validation)
};

function getActiveModels() {
  return dynamicModels;
}

function setActiveModels(newModels) {
  dynamicModels = { ...dynamicModels, ...newModels };
  console.log('[Router] Dynamic model mapping updated:', dynamicModels);
}

// Initialize Gemini client
let genAI = null;
function getGeminiClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Call Groq API for fast inference
 */
async function callGroq(prompt, systemPrompt = '', maxTokens = 1024, sessionId = 'session-global') {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELS.fast.model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Groq error: ${JSON.stringify(data)}`);
  }
  const content = data.choices[0].message.content;
  
  // Log token and cost usage
  logUsage(sessionId, MODELS.fast.name, systemPrompt + '\n' + prompt, content);
  
  return content;
}

/**
 * Call Gemini API
 */
async function callGemini(prompt, systemPrompt = '', modelType = 'deep', sessionId = 'session-global') {
  const client = getGeminiClient();
  const modelConfig = modelType === 'flash' ? MODELS.flash : MODELS.deep;
  const model = client.getGenerativeModel({
    model: modelConfig.model,
    systemInstruction: systemPrompt || undefined
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Log token and cost usage
  logUsage(sessionId, modelConfig.name, systemPrompt + '\n' + prompt, text);

  return text;
}

/**
 * Call Anthropic Claude API for validation
 */
async function callClaude(prompt, systemPrompt = '', maxTokens = 1024, sessionId = 'session-global') {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[Router] ANTHROPIC_API_KEY not found. Falling back to Gemini Pro for validation.');
    return await callGemini(prompt, systemPrompt, 'deep', sessionId);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODELS.validation.model,
      max_tokens: maxTokens,
      system: systemPrompt || undefined,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Anthropic error: ${JSON.stringify(data)}`);
  }
  const content = data.content[0].text;

  // Log token and cost usage
  logUsage(sessionId, MODELS.validation.name, systemPrompt + '\n' + prompt, content);

  return content;
}

/**
 * Classify which agent should handle a user request.
 * dynamically uses whichever model is currently mapped to 'router'.
 */
async function classifyIntent(userInput, sessionId = 'session-global') {
  const systemPrompt = agentsConfig.router.systemPrompt;
  
  const modelType = dynamicModels.router;
  let result;
  
  console.log(`[Router] Running Classification intent using router model: ${modelType}`);
  
  if (modelType === 'fast') {
    result = await callGroq(userInput, systemPrompt, 256, sessionId);
  } else if (modelType === 'validation') {
    result = await callClaude(userInput, systemPrompt, 256, sessionId);
  } else {
    result = await callGemini(userInput, systemPrompt, modelType, sessionId);
  }

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (err) {
    console.error('[Router] Failed to parse classification:', result);
    return { agent: 'research', reason: 'classification failed, defaulting', complexity: 'moderate' };
  }
}

/**
 * Pick the right model based on task complexity
 */
function selectModel(complexity) {
  switch (complexity) {
    case 'simple':
      return 'fast';
    case 'complex':
      return 'deep';
    case 'validation':
      return 'validation';
    default:
      return 'flash';
  }
}

/**
 * Generate a response using the appropriate model
 * Supports dynamic model configurations when role matches
 */
async function generateResponse(prompt, systemPrompt = '', complexity = 'moderate', sessionId = 'session-global') {
  let modelType;
  
  if (['router', 'research', 'action', 'validator'].includes(complexity)) {
    modelType = dynamicModels[complexity];
  } else {
    modelType = selectModel(complexity);
  }

  console.log(`[Router] Using model: ${MODELS[modelType]?.name || modelType} for role/complexity: ${complexity}`);

  if (modelType === 'fast') {
    return await callGroq(prompt, systemPrompt, 1024, sessionId);
  } else if (modelType === 'validation') {
    return await callClaude(prompt, systemPrompt, 1024, sessionId);
  } else {
    return await callGemini(prompt, systemPrompt, modelType, sessionId);
  }
}

module.exports = {
  MODELS,
  callGroq,
  callGemini,
  callClaude,
  classifyIntent,
  selectModel,
  generateResponse,
  getActiveModels,
  setActiveModels
};
