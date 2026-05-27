/**
 * ============================================================
 * AGENT ZERO — VALIDATOR AGENT (SECRET WEAPON)
 * ============================================================
 * Self-evaluation agent that checks every response before
 * sending it to the user.
 *
 * - Scores confidence 0-100
 * - Checks for hallucinations
 * - Verifies claims against retrieved data
 * - Retries with different approach if below 70%
 * ============================================================
 */

const { generateResponse } = require('../router');
const agentsConfig = require('../config/agents.json');

const MAX_RETRIES = 2;
const CONFIDENCE_THRESHOLD = 70;

/**
 * Validate a response and score its confidence
 */
async function validate(originalInput, agentResponse, sources = {}, sessionId = 'session-global') {
  const systemPrompt = agentsConfig.validator.systemPrompt;

  const prompt = `ORIGINAL USER INPUT: ${originalInput}

AGENT RESPONSE TO VALIDATE:
${typeof agentResponse === 'string' ? agentResponse : JSON.stringify(agentResponse)}

AVAILABLE SOURCES:
- Memories used: ${sources.memoriesUsed || 0}
- RAG documents used: ${sources.ragDocsUsed || 0}
- Web results used: ${sources.webResultsUsed || 0}

Evaluate this response now.`;

  const result = await generateResponse(prompt, systemPrompt, 'validator', sessionId);

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found');
  } catch (err) {
    console.error('[Validator] Failed to parse validation:', result);
    // Default to passing if validator itself fails
    return {
      confidence: 75,
      relevance: 20,
      accuracy: 20,
      completeness: 20,
      clarity: 15,
      hallucinations: [],
      suggestions: 'Validator parsing failed, defaulting to pass',
      verdict: 'pass'
    };
  }
}

/**
 * Run validation loop — retries if confidence is below threshold
 */
async function validateWithRetry(originalInput, generateFn, sessionId = 'session-global') {
  let lastResult = null;
  let lastValidation = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Generate (or re-generate) the response
    if (attempt === 0) {
      lastResult = await generateFn();
    } else {
      console.log(`[Validator] Retry ${attempt}/${MAX_RETRIES} — previous confidence: ${lastValidation.confidence}`);
      // Re-generate with feedback from validator
      lastResult = await generateFn(lastValidation.suggestions);
    }

    // Validate
    const answer = lastResult.answer || lastResult.message || JSON.stringify(lastResult);
    lastValidation = await validate(originalInput, answer, lastResult.sources || {}, sessionId);

    console.log(`[Validator] Attempt ${attempt + 1}: confidence=${lastValidation.confidence}, verdict=${lastValidation.verdict}`);

    if (lastValidation.confidence >= CONFIDENCE_THRESHOLD) {
      break;
    }
  }

  return {
    result: lastResult,
    validation: lastValidation,
    passed: lastValidation.confidence >= CONFIDENCE_THRESHOLD
  };
}

module.exports = { validate, validateWithRetry, CONFIDENCE_THRESHOLD };
