/**
 * ============================================================
 * TOOL 2: Web Scraper — Browser Use Integration
 * ============================================================
 * Triggers browser-use agent to control a real browser.
 * Open source: github.com/browser-use/browser-use
 * 
 * For hackathon: This calls a local browser-use Python server
 * or an n8n workflow that triggers browser automation.
 * 
 * Input:  { url: string, task?: string }
 * Output: { content: string, screenshots?: string[], status }
 * 
 * WOW FACTOR: Judges watch browser move by itself on screen.
 * ============================================================
 */

const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');
const { generateResponse } = require('../orchestrator/router');

async function scrapeWeb(url, task = 'Extract all main content from this page') {
  try {
    console.log(`[WebScraper] Launching local browser-use agent for ${url}`);
    
    const scriptPath = path.join(__dirname, 'python_browser_agent.py');
    
    // Execute the python script, passing URL and Task as arguments
    // NOTE: This assumes 'python' is in your PATH and dependencies (browser-use, langchain-openai) are installed
    const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${url}" "${task}"`, {
      timeout: 120000 // 2 minutes max for browser automation
    });

    if (stderr && !stdout) {
      console.warn(`[WebScraper] Python stderr: ${stderr}`);
    }

    // Parse the JSON output from the python script
    let result;
    try {
      result = JSON.parse(stdout);
    } catch (e) {
      console.warn(`[WebScraper] Could not parse JSON from python. Raw output: ${stdout}`);
      return await simpleFetch(url); // Fallback
    }

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      success: true,
      url,
      content: result.content,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.warn(`[WebScraper] Browser automation failed, trying fallback: ${error.message}`);
    return await simpleFetch(url);
  }
}

// Fallback: Basic HTTP content extraction
async function simpleFetch(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Basic HTML to text extraction
    const text = response.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Top-notch LLM extraction to get the clean text
    const prompt = `Extract all main readable content from this raw web text. Ignore navigation, footers, and noise. Return clean readable text. Text: ${text.substring(0, 12000)}`;
    const cleanContent = await generateResponse(prompt, 'You are an expert web extraction AI.', 'flash', 'web-scrape');

    return {
      success: true,
      url,
      content: cleanContent || text.substring(0, 5000),
      screenshots: [],
      fallback: true,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      url,
      content: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Dedicated LinkedIn Job Scraper (Top-notch LLM extraction)
async function scrapeLinkedInJob(url) {
  try {
    console.log(`[WebScraper] AI-powered scraping LinkedIn Job: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const text = response.data
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const prompt = `Extract the exact Job Title and the full Job Description/Criteria from this raw LinkedIn page text. Return ONLY a valid JSON object with keys "title" and "criteria". Text: ${text.substring(0, 15000)}`;
    const llmResp = await generateResponse(prompt, 'You are an ATS parsing expert.', 'flash', 'web-scrape');
    
    let parsed;
    try {
      const cleanJson = llmResp.replace(/^\s*```json/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch(e) {
      console.warn(`[WebScraper] JSON parse failed, using raw response`);
      parsed = { title: "Extracted Job Title", criteria: llmResp };
    }

    return {
      success: true,
      url,
      jobData: {
        title: parsed.title || "Unknown Title",
        criteria: parsed.criteria || "Description not found",
        source: 'LinkedIn'
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.warn(`[WebScraper] LinkedIn Scrape failed: ${error.message}`);
    return { success: false, url, error: error.message };
  }
}

module.exports = { scrapeWeb, simpleFetch, scrapeLinkedInJob };
