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
      .trim()
      .substring(0, 5000); // Limit to 5k chars

    return {
      success: true,
      url,
      content: text,
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

// Dedicated LinkedIn Job Scraper (Fast Regex extraction without JSDOM)
async function scrapeLinkedInJob(url) {
  try {
    console.log(`[WebScraper] Fast-scraping LinkedIn Job: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    
    // Extract Title
    let title = "Unknown Title";
    const titleMatch = html.match(/<h1[^>]*top-card-layout__title[^>]*>(.*?)<\/h1>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, '').trim();

    // Extract Description / Criteria
    let description = "Description not found";
    const descMatch = html.match(/<div[^>]*description__text[^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
      description = descMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return {
      success: true,
      url,
      jobData: {
        title,
        criteria: description,
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
