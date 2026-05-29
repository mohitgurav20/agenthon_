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
const agentsConfig = require('../config/agents.json');

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
 * Search for real jobs using RapidAPI JSearch
 */
async function searchJobsAPI(query) {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey || rapidApiKey.includes('your_')) {
      console.warn('[ResearchAgent] No RapidAPI key. Skipping JSearch.');
      return [];
    }

    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://jsearch.p.rapidapi.com/search?query=${encodedQuery}&num_pages=1`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      console.warn('[ResearchAgent] JSearch API returned', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (err) {
    console.warn('[ResearchAgent] JSearch API unavailable:', err.message);
    return [];
  }
}

/**
 * Run the Research Agent — fetches context + web results in PARALLEL
 * then synthesizes an answer with the LLM.
 */
async function run(userInput, sessionId, userId = 'agent-zero-user', complexity = 'moderate') {
  console.log('[ResearchAgent] Starting career research loop for:', userInput.substring(0, 80));

  const startTime = Date.now();

  const isJobSearch = userInput.toLowerCase().includes('job') || 
                      userInput.toLowerCase().includes('intern') || 
                      userInput.toLowerCase().includes('apply') ||
                      userInput.toLowerCase().includes('recommend') ||
                      userInput.toLowerCase().includes('crawl');

  const [context, webResults] = await Promise.all([
    getContext(userInput, userId),
    isJobSearch ? searchJobsAPI(userInput) : []
  ]);

  const parallelMs = Date.now() - startTime;
  console.log(`[ResearchAgent] Parallel fetch completed in ${parallelMs}ms`);

  // Extract user's parsed skills from Mem0 context to perform Semantic Gap Analysis
  const userSkills = [];
  const contextText = typeof context.context === 'string' ? context.context : JSON.stringify(context);
  
  // Extract standard tech keywords from memory to match
  const technologies = ['React', 'Node', 'Supabase', 'Docker', 'Postgres', 'Git', 'JavaScript', 'Express', 'Redis', 'AWS'];
  technologies.forEach(tech => {
    if (new RegExp(`\\b${tech}\\b`, 'i').test(contextText)) {
      userSkills.push(tech);
    }
  });

  // Default fallback skills if memory is brand new
  if (userSkills.length === 0) {
    userSkills.push('React', 'Node.js', 'Supabase', 'Git');
  }

  // ── Build crawled jobs list & run Semantic Gap Analysis ──
  let scrapedJobs = undefined;
  if (isJobSearch) {
    scrapedJobs = [];
    const rawResults = webResults || [];
    
    // Parse JSearch results to construct matching jobs
    rawResults.forEach((r, idx) => {
      const title = r.job_title || "Software Engineer";
      const company = r.employer_name || "Tech Company";
      const url = r.job_apply_link || r.job_google_link || '#';
      const description = r.job_description || title;

      // Determine required keywords in job details
      const requiredKeywords = [];
      technologies.forEach(tech => {
        if (new RegExp(`\\b${tech}\\b`, 'i').test(description)) {
          requiredKeywords.push(tech);
        }
      });
      if (requiredKeywords.length === 0) requiredKeywords.push('React', 'Node.js', 'Git');

      // Calculate Semantic Gap
      const matched = requiredKeywords.filter(k => userSkills.includes(k));
      const missing = requiredKeywords.filter(k => !userSkills.includes(k));
      const matchScore = requiredKeywords.length > 0 
        ? Math.round((matched.length / requiredKeywords.length) * 100) 
        : 85;

      scrapedJobs.push({
        title: title.includes('|') ? title.split('|')[0].trim() : title.substring(0, 40),
        company,
        url,
        match: matchScore,
        status: 'idle',
        keywords: requiredKeywords
      });
    });

    // Sort crawled jobs by match percentage desc
    scrapedJobs.sort((a, b) => b.match - a.match);
    scrapedJobs = scrapedJobs.slice(0, 3); // Take top 3
  }

  // ── Build enriched prompt ──
  const systemPrompt = agentsConfig.research.systemPrompt;

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

  const hugeAiPrompt = `
You are FLUX AI, an elite, hyper-intelligent career orchestration engine. 
You are tasked with analyzing the user's explicit episodic memory (skills, background, and exact GitHub/LinkedIn data) and mapping it precisely to the real-world scraped jobs provided below.
CRITICAL INSTRUCTIONS:
1. Synthesize a professional, comprehensive, and highly encouraging response.
2. If real jobs are found, explain exactly WHY the user is a good fit based on the semantic match between their GitHub/LinkedIn skills and the job's required technologies.
3. If no jobs are found, advise the user to broaden their search or upload a more detailed resume.
4. DO NOT make up generic responses. Use the raw data provided.
`;

  const enrichedPrompt = `${hugeAiPrompt}

USER QUESTION: ${userInput}

--- USER CONTEXT (GitHub & LinkedIn Memories) ---
${contextBlock}

--- REAL JOB SEARCH RESULTS (from RapidAPI JSearch) ---
${webResults.length > 0
    ? webResults.map((r, i) => `[Job ${i + 1}]: ${r.job_title} at ${r.employer_name} — Required: ${r.job_description ? r.job_description.substring(0, 300) : ''}... (${r.job_apply_link})`).join('\n')
    : '(no real job results found)'}

Please synthesize a comprehensive answer using all available real data sources.`;

  // ── Generate response using the right model ──
  const answer = await generateResponse(enrichedPrompt, systemPrompt, 'research', sessionId);

  const totalMs = Date.now() - startTime;

  return {
    agent: 'research',
    answer,
    scrapedJobs, // Return structured crawled jobs directly to main orchestrator
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
