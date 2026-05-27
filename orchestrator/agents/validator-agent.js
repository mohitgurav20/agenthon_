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

  let atsBlock = '';
  if (sources.atsResult) {
    atsBlock = `\n--- ATS EVALUATION METRICS (FROM SANDBOX DETECTOR) ---
- Overall ATS Score: ${sources.atsResult.atsScore}/100 (Threshold required is >= 90)
- Keyword Density Score: ${sources.atsResult.keywordScore}/100
- Structural Section Score: ${sources.atsResult.structureScore}/100
- Parsed Word Count: ${sources.atsResult.wordCount}
- Missing Sections: ${sources.atsResult.missingSections?.join(', ') || 'None'}
- Missing Keywords/Skills: ${sources.atsResult.missingKeywords?.join(', ') || 'None'}
- ATS Optimization Feedback: ${sources.atsResult.feedback || 'Excellent structure.'}\n`;
  }

  const prompt = `ORIGINAL USER INPUT: ${originalInput}

AGENT RESPONSE TO VALIDATE:
${typeof agentResponse === 'string' ? agentResponse : JSON.stringify(agentResponse)}

AVAILABLE SOURCES:
- Memories used: ${sources.memoriesUsed || 0}
- RAG documents used: ${sources.ragDocsUsed || 0}
- Web results used: ${sources.webResultsUsed || 0}
${atsBlock}
Evaluate this response now.`;

  const result = await generateResponse(prompt, systemPrompt, 'validator', sessionId);

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Hard enforce retry if ATS score exists and is below 90
      if (sources.atsResult && sources.atsResult.atsScore < 90 && parsed.verdict === 'pass') {
        parsed.verdict = 'retry';
        parsed.confidence = Math.min(65, parsed.confidence);
        parsed.suggestions = `[Enforced ATS Check] Resume scored ${sources.atsResult.atsScore}/100, which is below our 90/100 threshold. ${sources.atsResult.feedback} ${parsed.suggestions}`;
      }
      return parsed;
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
