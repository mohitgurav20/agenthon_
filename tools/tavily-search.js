/**
 * ============================================================
 * TOOL 1: Web Search — Tavily API
 * ============================================================
 * Tavily returns clean, structured, LLM-ready search results.
 * Free tier: 1000 searches/month.
 * 
 * Input:  { query: string, maxResults?: number }
 * Output: { results: [{ title, url, content, score }], query, timestamp }
 * 
 * Retry: 3 attempts on failure, then fallback to empty results.
 * ============================================================
 */

const axios = require('axios');

const TAVILY_API_URL = 'https://api.tavily.com/search';

async function searchWeb(query, options = {}) {
  const {
    maxResults = 5,
    searchDepth = 'basic', // 'basic' or 'advanced'
    includeAnswer = true,
    retries = 3
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(TAVILY_API_URL, {
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_answer: includeAnswer,
        include_raw_content: false
      }, {
        timeout: 15000
      });

      const data = response.data;

      return {
        success: true,
        query,
        answer: data.answer || null,
        results: (data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score
        })),
        sources: (data.results || []).map(r => r.url),
        timestamp: new Date().toISOString(),
        attempt
      };

    } catch (error) {
      lastError = error;
      console.warn(`[Tavily] Attempt ${attempt}/${retries} failed: ${error.message}`);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // All retries failed
  console.error(`[Tavily] All ${retries} attempts failed for query: "${query}"`);
  return {
    success: false,
    query,
    answer: null,
    results: [],
    sources: [],
    error: lastError?.message || 'All retry attempts failed',
    timestamp: new Date().toISOString()
  };
}

// Dedicated Job Crawler for Hackathon
async function searchJobBoards({ language, role, location = "" }) {
  // Advanced dork to specifically hit live job posts on major ATS platforms
  const query = `(site:boards.greenhouse.io OR site:jobs.lever.co OR site:linkedin.com/jobs OR site:naukri.com/job-listings) "${role}" "${language}" ${location}`;
  
  console.log(`[JobCrawler] Hunting for jobs using Dork: ${query}`);
  
  return searchWeb(query, { maxResults: 10, searchDepth: 'advanced', includeAnswer: false });
}

module.exports = { searchWeb, searchJobBoards };
