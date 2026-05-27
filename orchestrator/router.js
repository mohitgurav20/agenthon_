/**
 * ============================================================
 * AGENT ZERO — MULTI-MODEL ROUTER
 * ============================================================
 * Routes tasks to the optimal LLM based on task type.
 * - Groq (Llama 3.1 70B): Ultra-fast routing decisions, 800 tok/sec
 * - Gemini 1.5 Pro: Deep reasoning, complex analysis
 * - Gemini 1.5 Flash: Quick summaries, web search digestion
 * ============================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

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
async function callGroq(prompt, systemPrompt = '', maxTokens = 1024) {
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
  return data.choices[0].message.content;
}

/**
 * Call Gemini API
 */
async function callGemini(prompt, systemPrompt = '', modelType = 'deep') {
  const client = getGeminiClient();
  const modelConfig = modelType === 'flash' ? MODELS.flash : MODELS.deep;
  const model = client.getGenerativeModel({
    model: modelConfig.model,
    systemInstruction: systemPrompt || undefined
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Call Anthropic Claude API for validation
 */
async function callClaude(prompt, systemPrompt = '', maxTokens = 1024) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[Router] ANTHROPIC_API_KEY not found. Falling back to Gemini Pro for validation.');
    return await callGemini(prompt, systemPrompt, 'deep');
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
  return data.content[0].text;
}

/**
 * Classify which agent should handle a user request.
 * Uses Groq for speed (~200ms vs 2s+ for Gemini).
 */
async function classifyIntent(userInput) {
  const systemPrompt = `You are a routing classifier. Given a user message, respond with EXACTLY one JSON object:
{
  "agent": "research" | "action" | "memory",
  "reason": "brief explanation",
  "complexity": "simple" | "moderate" | "complex"
}

Rules:
- "research": user wants facts, information, analysis, comparisons, or answers to questions
- "action": user wants to DO something (send email, make call, generate report, scrape website)
- "memory": user asks about past conversations, preferences, or history

Respond with ONLY the JSON object. No other text.`;

  const result = await callGroq(userInput, systemPrompt, 256);

  try {
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (err) {
    console.error('[Router] Failed to parse classification:', result);
    // Default to research if classification fails
    return { agent: 'research', reason: 'classification failed, defaulting', complexity: 'moderate' };
  }
}

/**
 * Pick the right model based on task complexity
 */
function selectModel(complexity) {
  switch (complexity) {
    case 'simple':
      return 'fast';       // Groq — instant
    case 'complex':
      return 'deep';       // Gemini Pro — thorough
    case 'validation':
      return 'validation'; // Claude — strict validator
    default:
      return 'flash';      // Gemini Flash — balanced
  }
}

/**
 * Generate a response using the appropriate model
 */
async function generateResponse(prompt, systemPrompt = '', complexity = 'moderate') {
  const modelType = selectModel(complexity);

  console.log(`[Router] Using model: ${MODELS[modelType].name} (${complexity})`);

  if (modelType === 'fast') {
    return await callGroq(prompt, systemPrompt);
  } else if (modelType === 'validation') {
    return await callClaude(prompt, systemPrompt);
  } else {
    return await callGemini(prompt, systemPrompt, modelType);
  }
}

module.exports = {
  MODELS,
  callGroq,
  callGemini,
  callClaude,
  classifyIntent,
  selectModel,
  generateResponse
};
