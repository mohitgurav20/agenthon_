/**
 * ============================================================
 * AGENT ZERO — LANGFUSE OBSERVABILITY WRAPPER
 * ============================================================
 * Wraps all agent calls with Langfuse tracing so judges can
 * see every decision the agent makes in real time.
 *
 * Shows: token usage, latency, decisions, confidence, tool calls
 * ============================================================
 */

const { Langfuse } = require('langfuse');

let langfuse = null;

function getLangfuse() {
  if (!langfuse && process.env.LANGFUSE_SECRET_KEY) {
    langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
    });
    console.log('[Langfuse] ✅ Observability connected');
  }
  return langfuse;
}

/**
 * Create a new trace for a user session
 */
function createTrace(sessionId, userId, input) {
  const lf = getLangfuse();
  if (!lf) return null;

  return lf.trace({
    name: 'agent-zero-orchestrator',
    sessionId,
    userId,
    input,
    metadata: {
      project: 'agent-zero',
      environment: process.env.NODE_ENV || 'development'
    }
  });
}

/**
 * Log a generation (LLM call) to Langfuse
 */
function logGeneration(trace, name, input, output, model, latencyMs, metadata = {}) {
  if (!trace) return;

  trace.generation({
    name,
    input,
    output,
    model,
    metadata: {
      latencyMs,
      ...metadata
    }
  });
}

/**
 * Log a span (non-LLM operation like tool call or memory fetch)
 */
function logSpan(trace, name, input, output, latencyMs, metadata = {}) {
  if (!trace) return;

  const span = trace.span({
    name,
    input,
    metadata: { latencyMs, ...metadata }
  });

  span.end({ output });
  return span;
}

/**
 * Log the final validation score
 */
function logScore(trace, validation) {
  if (!trace || !validation) return;

  trace.score({
    name: 'confidence',
    value: validation.confidence / 100,
    comment: `Relevance: ${validation.relevance}, Accuracy: ${validation.accuracy}, Completeness: ${validation.completeness}, Clarity: ${validation.clarity}`
  });
}

/**
 * Flush all pending events (call before process exits)
 */
async function flush() {
  const lf = getLangfuse();
  if (lf) {
    await lf.flushAsync();
  }
}

module.exports = {
  getLangfuse,
  createTrace,
  logGeneration,
  logSpan,
  logScore,
  flush
};
