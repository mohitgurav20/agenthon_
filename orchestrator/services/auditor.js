/**
 * ============================================================
 * AGENT ZERO — TOKEN & COST AUDITOR SERVICE
 * ============================================================
 * Tracks precise cumulative tokens and API cost models per session
 * and server-wide cumulative totals.
 *
 * Uses a character-heuristic estimator:
 *   - 1 token ≈ 4 characters
 *
 * Cost Models (per 1,000,000 tokens):
 *   - Llama 3.1 70B (Groq):    Input $0.59, Output $0.79
 *   - Gemini 1.5 Pro (Google): Input $1.25, Output $5.00
 *   - Gemini 1.5 Flash (Google):Input $0.075, Output $0.30
 *   - Claude 3.5 Sonnet (Anth): Input $3.00, Output $15.00
 * ============================================================
 */

// Cost configurations per 1,000,000 tokens
const PRICING_PLANS = {
  groq: {
    inputPrice: 0.59,
    outputPrice: 0.79
  },
  'gemini-pro': {
    inputPrice: 1.25,
    outputPrice: 5.00
  },
  'gemini-flash': {
    inputPrice: 0.075,
    outputPrice: 0.30
  },
  claude: {
    inputPrice: 3.00,
    outputPrice: 15.00
  },
  default: {
    inputPrice: 1.00,
    outputPrice: 3.00
  }
};

// In-memory data store for tracking session & global costs
const sessionStats = new Map();
const globalStats = {
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
  modelBreakdown: {}
};

/**
 * Estimate tokens from raw string content (characters / 4)
 */
function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') text = JSON.stringify(text);
  return Math.ceil(text.length / 4);
}

/**
 * Identify the pricing plan key from the model identifier
 */
function getPricingPlan(modelName) {
  if (!modelName) return PRICING_PLANS.default;
  const lower = modelName.toLowerCase();
  
  if (lower.includes('llama') || lower.includes('groq')) {
    return PRICING_PLANS.groq;
  }
  if (lower.includes('gemini-1.5-pro') || lower.includes('gemini-pro') || lower.includes('deep')) {
    return PRICING_PLANS['gemini-pro'];
  }
  if (lower.includes('gemini-1.5-flash') || lower.includes('gemini-flash') || lower.includes('flash')) {
    return PRICING_PLANS['gemini-flash'];
  }
  if (lower.includes('claude') || lower.includes('sonnet') || lower.includes('validation')) {
    return PRICING_PLANS.claude;
  }
  return PRICING_PLANS.default;
}

/**
 * Log an LLM invocation's token usage and cost
 */
function logUsage(sessionId, modelName, promptText, completionText) {
  const inputTokens = estimateTokens(promptText);
  const outputTokens = estimateTokens(completionText);
  
  const plan = getPricingPlan(modelName);
  
  const inputCost = (inputTokens / 1000000) * plan.inputPrice;
  const outputCost = (outputTokens / 1000000) * plan.outputPrice;
  const totalCost = inputCost + outputCost;

  // Initialize or fetch session tracking
  if (!sessionStats.has(sessionId)) {
    sessionStats.set(sessionId, {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      calls: []
    });
  }

  const session = sessionStats.get(sessionId);
  session.totalCalls += 1;
  session.totalInputTokens += inputTokens;
  session.totalOutputTokens += outputTokens;
  session.totalCost += totalCost;
  
  session.calls.push({
    timestamp: new Date().toISOString(),
    model: modelName,
    inputTokens,
    outputTokens,
    cost: totalCost
  });

  // Log global statistics
  globalStats.totalCalls += 1;
  globalStats.totalInputTokens += inputTokens;
  globalStats.totalOutputTokens += outputTokens;
  globalStats.totalCost += totalCost;

  if (!globalStats.modelBreakdown[modelName]) {
    globalStats.modelBreakdown[modelName] = { calls: 0, tokens: 0, cost: 0 };
  }
  globalStats.modelBreakdown[modelName].calls += 1;
  globalStats.modelBreakdown[modelName].tokens += (inputTokens + outputTokens);
  globalStats.modelBreakdown[modelName].cost += totalCost;

  console.log(`[TokenAuditor] Session: ${sessionId} | Model: ${modelName} | Prompt Tok: ${inputTokens} | Comp Tok: ${outputTokens} | Cost: $${totalCost.toFixed(6)}`);
  
  return { inputTokens, outputTokens, cost: totalCost };
}

/**
 * Retrieve audit logs summary for a single session
 */
function getSessionSummary(sessionId) {
  if (!sessionStats.has(sessionId)) {
    return {
      sessionId,
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      calls: []
    };
  }
  return {
    sessionId,
    ...sessionStats.get(sessionId)
  };
}

/**
 * Retrieve system-wide token & cost summary metrics
 */
function getGlobalSummary() {
  return {
    ...globalStats
  };
}

module.exports = {
  logUsage,
  getSessionSummary,
  getGlobalSummary,
  estimateTokens
};
