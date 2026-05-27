/**
 * ============================================================
 * AGENT ZERO — MAIN ORCHESTRATOR
 * ============================================================
 * The brain of Agent Zero. Receives user input, classifies
 * intent, delegates to the right worker agent, validates
 * the response, stores memory, and returns the final answer.
 *
 * Flow:
 *   User Input
 *     → Router (Groq, ~200ms) classifies intent
 *     → Research Agent OR Action Agent (parallel memory + tools)
 *     → Validator Agent (confidence check, retry if < 70%)
 *     → Store memory (Mem0 via Person C's API)
 *     → Store to Supabase (agent_outputs table)
 *     → Return final response
 * ============================================================
 */

const { classifyIntent } = require('./router');
const researchAgent = require('./agents/research-agent');
const actionAgent = require('./agents/action-agent');
const { validateWithRetry } = require('./agents/validator-agent');
const langfuse = require('./langfuse');

const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';

/**
 * Store a memory after each interaction
 */
async function storeMemory(userInput, agentResponse, userId = 'agent-zero-user') {
  try {
    const text = `User: ${userInput}\nAssistant: ${typeof agentResponse === 'string' ? agentResponse : JSON.stringify(agentResponse)}`;
    await fetch(`${MEMORY_API}/memory/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        userId
      })
    });
    console.log('[Orchestrator] Memory stored');
  } catch (err) {
    console.warn('[Orchestrator] Failed to store memory:', err.message);
  }
}

/**
 * Main orchestrator function — the single entry point
 */
async function processInput({ userInput, sessionId, userId = 'agent-zero-user' }) {
  const totalStart = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log(`[Orchestrator] New request from ${userId}`);
  console.log(`[Orchestrator] Input: "${userInput.substring(0, 100)}"`);
  console.log('='.repeat(60));

  // ── Step 0: Create Langfuse trace ──
  const trace = langfuse.createTrace(sessionId, userId, userInput);

  // ── Step 1: Classify intent using Groq (fast) ──
  const classifyStart = Date.now();
  const classification = await classifyIntent(userInput);
  const classifyMs = Date.now() - classifyStart;

  console.log(`[Orchestrator] Classified as: ${classification.agent} (${classification.complexity}) in ${classifyMs}ms`);
  console.log(`[Orchestrator] Reason: ${classification.reason}`);

  langfuse.logGeneration(trace, 'intent-classification', userInput, JSON.stringify(classification), 'groq-llama-3.1', classifyMs);

  // ── Step 2: Delegate to the right agent ──
  let agentResult;

  const generateFn = async (retryHint) => {
    const modifiedInput = retryHint
      ? `${userInput}\n\n[SYSTEM: Previous answer was rejected. Improve based on: ${retryHint}]`
      : userInput;

    if (classification.agent === 'action') {
      return await actionAgent.run(modifiedInput, sessionId, userId, classification.complexity);
    } else {
      // Default to research for both 'research' and 'memory' intents
      return await researchAgent.run(modifiedInput, sessionId, userId, classification.complexity);
    }
  };

  // ── Step 3: Run with validation loop ──
  const { result, validation, passed } = await validateWithRetry(userInput, generateFn);
  agentResult = result;

  const validationEmoji = passed ? '✅' : '⚠️';
  console.log(`[Orchestrator] Validation: ${validationEmoji} confidence=${validation.confidence}, verdict=${validation.verdict}`);

  langfuse.logScore(trace, validation);

  // ── Step 4: Store memory of this interaction (async, non-blocking) ──
  const answer = agentResult.answer || agentResult.message || JSON.stringify(agentResult);
  storeMemory(userInput, answer, userId).catch(() => {}); // fire and forget

  // ── Step 5: Build final response ──
  const totalMs = Date.now() - totalStart;

  const finalResponse = {
    sessionId,
    response: answer,
    confidence: validation.confidence,
    validation: {
      relevance: validation.relevance,
      accuracy: validation.accuracy,
      completeness: validation.completeness,
      clarity: validation.clarity,
      hallucinations: validation.hallucinations || [],
      passed
    },
    agent: classification.agent,
    complexity: classification.complexity,
    sources: agentResult.sources || {},
    actionLogs: agentResult.actionLogs || undefined,
    performance: {
      totalMs,
      classificationMs: classifyMs,
      agentMs: agentResult.latencyMs || 0
    }
  };

  console.log(`[Orchestrator] ✅ Done in ${totalMs}ms | confidence: ${validation.confidence}/100\n`);

  // Flush Langfuse traces
  langfuse.flush().catch(() => {});

  return finalResponse;
}

module.exports = { processInput };
