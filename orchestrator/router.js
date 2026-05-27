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
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    genAI = new GoogleGenerativeAI(key && !key.includes('your_') ? key : 'placeholder_fallback');
  }
  return genAI;
}

/**
 * Robust Context Compressor & Token Pruner
 * Keeps context under a safe threshold, optimizing billing costs and speed.
 */
function compressPrompt(prompt, maxChars = 12000) {
  if (!prompt || prompt.length <= maxChars) return prompt;

  console.log(`[Router ContextCompressor] Prompt length (${prompt.length}) exceeds safe limit (${maxChars}). Compressing context...`);
  
  let compressed = prompt;
  
  // 1. Remove consecutive blank lines and excess trailing spaces
  compressed = compressed.replace(/\n\s*\n/g, '\n\n').trim();
  
  if (compressed.length <= maxChars) return compressed;

  // 2. Identify heavy payload sections and compress them
  const sections = compressed.split('---');
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    // Truncate Tavily or Supabase KB dumps if they exceed 4000 chars
    if ((section.includes('WEB SEARCH RESULTS') || section.includes('KNOWLEDGE BASE') || section.includes('USER CONTEXT')) && section.length > 4000) {
      console.log(`[Router ContextCompressor] Pruning content of section starting with: "${section.substring(0, 35).trim()}..."`);
      sections[i] = section.substring(0, 2500) + '\n\n... [TRUNCATED & COMPRESSED FOR LIVE PERFORMANCE OPTIMIZATION] ...\n\n';
    }
  }
  
  compressed = sections.join('---');
  
  // 3. Fallback hard truncate if still too long
  if (compressed.length > maxChars) {
    console.log(`[Router ContextCompressor] Hard truncating prompt to ${maxChars} chars.`);
    compressed = compressed.substring(0, maxChars) + '\n\n... [HARD LIMIT EXCEEDED - TRUNCATED TO PREVENT LLM CONTEXT OVERFLOW] ...';
  }
  
  return compressed;
}

/**
 * Resilient Groq Caller with Gemini Flash Fallback
 */
async function callGroq(prompt, systemPrompt = '', maxTokens = 1024, sessionId = 'session-global') {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.includes('your_')) {
      throw new Error("Groq API key is unconfigured or a placeholder.");
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      throw new Error(`Groq server error: ${data.error?.message || JSON.stringify(data)}`);
    }
    const content = data.choices[0].message.content;
    
    // Log token and cost usage
    logUsage(sessionId, MODELS.fast.name, systemPrompt + '\n' + prompt, content);
    
    return content;
  } catch (err) {
    console.warn(`[Router Fallback] callGroq failed: "${err.message}". Cascading call to Gemini Flash...`);
    return await callGemini(prompt, systemPrompt, 'flash', sessionId);
  }
}

/**
 * Resilient Groq execution (No fallback recursion)
 */
async function callGroqResilient(prompt, systemPrompt = '', maxTokens = 1024, sessionId = 'session-global') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    throw new Error("Groq key unavailable");
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  if (!response.ok) throw new Error(data.error?.message || "Groq internal");
  return data.choices[0].message.content;
}

/**
 * Resilient Gemini Caller with Multi-Model Fallbacks
 */
async function callGemini(prompt, systemPrompt = '', modelType = 'deep', sessionId = 'session-global') {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || apiKey.includes('your_')) {
      throw new Error("Gemini API key is unconfigured or a placeholder.");
    }

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
  } catch (err) {
    console.error(`[Router Fallback] callGemini (${modelType}) failed: "${err.message}". Attempting model cascade...`);
    
    if (modelType === 'deep') {
      try {
        console.log("[Router Fallback] Retrying with Gemini Flash model...");
        const client = getGeminiClient();
        const model = client.getGenerativeModel({
          model: MODELS.flash.model,
          systemInstruction: systemPrompt || undefined
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        logUsage(sessionId, MODELS.flash.name, systemPrompt + '\n' + prompt, text);
        return text;
      } catch (err2) {
        console.error("[Router Fallback] Gemini Flash retry failed:", err2.message);
      }
    }

    // Try Groq as absolute emergency fallback
    if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('your_')) {
      console.log("[Router Fallback] Emergency redirecting Gemini query to Groq...");
      try {
        return await callGroqResilient(prompt, systemPrompt, 1024, sessionId);
      } catch (err3) {
        console.error("[Router Fallback] Groq fallback failed:", err3.message);
      }
    }

    throw err;
  }
}

/**
 * Resilient Claude Caller with Gemini Pro Fallback
 */
async function callClaude(prompt, systemPrompt = '', maxTokens = 1024, sessionId = 'session-global') {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.includes('your_')) {
      throw new Error("Anthropic API key is unconfigured or a placeholder.");
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
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
      throw new Error(`Anthropic server error: ${data.error?.message || JSON.stringify(data)}`);
    }
    const content = data.content[0].text;

    // Log token and cost usage
    logUsage(sessionId, MODELS.validation.name, systemPrompt + '\n' + prompt, content);

    return content;
  } catch (err) {
    console.warn(`[Router Fallback] callClaude failed: "${err.message}". Cascading call to Gemini Pro...`);
    return await callGemini(prompt, systemPrompt, 'deep', sessionId);
  }
}

/**
 * Classify which agent should handle a user request.
 */
async function classifyIntent(userInput, sessionId = 'session-global') {
  const systemPrompt = agentsConfig.router.systemPrompt;
  const modelType = dynamicModels.router;
  let result;
  
  console.log(`[Router] Running Classification intent using router model: ${modelType}`);
  
  try {
    if (modelType === 'fast') {
      result = await callGroq(userInput, systemPrompt, 256, sessionId);
    } else if (modelType === 'validation') {
      result = await callClaude(userInput, systemPrompt, 256, sessionId);
    } else {
      result = await callGemini(userInput, systemPrompt, modelType, sessionId);
    }
  } catch (err) {
    console.error('[Router Exception] Classification failed. Falling back to default mock-intent router.', err.message);
    result = JSON.stringify({ agent: 'research', reason: 'classification error fallback', complexity: 'moderate' });
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
  // 1. Context Compression & Token Pruning
  const optimizedPrompt = compressPrompt(prompt);

  let modelType;
  if (['router', 'research', 'action', 'validator'].includes(complexity)) {
    modelType = dynamicModels[complexity];
  } else {
    modelType = selectModel(complexity);
  }

  console.log(`[Router] Using model: ${MODELS[modelType]?.name || modelType} for role/complexity: ${complexity}`);

  try {
    if (modelType === 'fast') {
      return await callGroq(optimizedPrompt, systemPrompt, 1024, sessionId);
    } else if (modelType === 'validation') {
      return await callClaude(optimizedPrompt, systemPrompt, 1024, sessionId);
    } else {
      return await callGemini(optimizedPrompt, systemPrompt, modelType, sessionId);
    }
  } catch (err) {
    console.error(`[Router Fatal Error] generateResponse completely failed for modelType ${modelType}:`, err.message);
    console.log('[Router Fallback] Dispatching last-resort bulletproof call to Gemini Flash...');
    try {
      return await callGemini(optimizedPrompt, systemPrompt, 'flash', sessionId);
    } catch (err2) {
      console.error('[Router Fallback] Gemini Flash last-resort also failed! Defaulting to clean error placeholder text.');
      return `[API ERROR FALLBACK] We are experiencing high load or API timeouts. Please try again. details: ${err.message}`;
    }
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
  setActiveModels,
  compressPrompt
};
