/**
 * ============================================================
 * AGENT ZERO — RESEARCH AGENT
 * ============================================================
 * Worker agent that handles fact-finding, knowledge retrieval,
 * and information synthesis.
 *
 * Data sources:
 *   - Person C's Memory API (Mem0 + Supabase RAG) on port 3001
 *   - Person B's Tavily Search Tool on port 3000
 * ============================================================
 */

const { generateResponse } = require('../router');

const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
const TOOLS_API = process.env.TOOLS_API_URL || 'http://localhost:3000';

/**
 * Retrieve relevant memories + RAG context from Person C's API
 */
async function getContext(query, userId = 'agent-zero-user') {
  try {
    const response = await fetch(`${MEMORY_API}/memory/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, userId })
    });

    if (!response.ok) {
      console.warn('[ResearchAgent] Memory API returned', response.status);
      return { memories: [], ragResults: [] };
    }

    return await response.json();
  } catch (err) {
    console.warn('[ResearchAgent] Memory API unavailable:', err.message);
    return { memories: [], ragResults: [] };
  }
}

/**
 * Search the web via Person B's Tavily tool
 */
async function searchWeb(query) {
  try {
    const response = await fetch(`${TOOLS_API}/api/tools/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxResults: 5 })
    });

    if (!response.ok) {
      console.warn('[ResearchAgent] Tools API search returned', response.status);
      return [];
    }

    const data = await response.json();
    return data.result || data.results || [];
  } catch (err) {
    console.warn('[ResearchAgent] Tools API unavailable:', err.message);
    return [];
  }
}

/**
 * Run the Research Agent — fetches context + web results in PARALLEL
 * then synthesizes an answer with the LLM.
 */
async function run(userInput, sessionId, userId = 'agent-zero-user', complexity = 'moderate') {
  console.log('[ResearchAgent] Starting research for:', userInput.substring(0, 80));

  const startTime = Date.now();

  // ── PARALLEL FETCH: Memory + Web Search simultaneously ──
  const [context, webResults] = await Promise.all([
    getContext(userInput, userId),
    searchWeb(userInput)
  ]);

  const parallelMs = Date.now() - startTime;
  console.log(`[ResearchAgent] Parallel fetch completed in ${parallelMs}ms`);

  // ── Build enriched prompt ──
  const systemPrompt = `You are the Research Agent for Agent Zero. Your job is to provide accurate, well-sourced answers.

You have been given:
1. USER CONTEXT (Memories from Mem0 & documents from Supabase RAG)
2. WEB SEARCH RESULTS — fresh information from the internet

RULES:
- Prioritize memories and knowledge base for personalized answers
- Use web results for current/factual information
- Always cite your sources (memory, knowledge base, or web)
- If you're unsure, say so honestly
- Return structured, clear responses`;

  // Format memories and knowledge base depending on API format
  let contextBlock = '';
  if (context && typeof context.context === 'string') {
    contextBlock = context.context;
  } else {
    const mems = context && context.memories && context.memories.length > 0
      ? context.memories.map((m, i) => `[Memory ${i + 1}]: ${m.memory || m.content || JSON.stringify(m)}`).join('\n')
      : '(no relevant memories found)';
    const docs = context && context.ragResults && context.ragResults.length > 0
      ? context.ragResults.map((r, i) => `[Doc ${i + 1}]: ${r.content || JSON.stringify(r)}`).join('\n')
      : '(no relevant documents found)';
    contextBlock = `--- USER MEMORIES (from Mem0) ---\n${mems}\n\n--- KNOWLEDGE BASE (from Supabase RAG) ---\n${docs}`;
  }

  const enrichedPrompt = `USER QUESTION: ${userInput}

--- USER CONTEXT ---
${contextBlock}

--- WEB SEARCH RESULTS (from Tavily) ---
${webResults.length > 0
    ? webResults.map((r, i) => `[Web ${i + 1}]: ${r.title || ''} — ${r.content || r.snippet || ''} (${r.url || ''})`).join('\n')
    : '(no web results found)'}

Please synthesize a comprehensive answer using all available sources.`;

  // ── Generate response using the right model ──
  const answer = await generateResponse(enrichedPrompt, systemPrompt, complexity);

  const totalMs = Date.now() - startTime;

  return {
    agent: 'research',
    answer,
    sources: {
      memoriesUsed: context.memories ? context.memories.length : 0,
      ragDocsUsed: context.ragResults ? context.ragResults.length : 0,
      webResultsUsed: webResults.length
    },
    latencyMs: totalMs,
    model: complexity
  };
}

module.exports = { run };
