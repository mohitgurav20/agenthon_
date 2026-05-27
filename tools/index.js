/**
 * ============================================================
 * AGENT ZERO — TOOLS REGISTRY
 * ============================================================
 * Person B owns this folder. All tools are exported here
 * so the Orchestrator/Action agents can load them dynamically.
 * ============================================================
 */

const { searchWeb } = require('./tavily-search');
const { scrapeWeb } = require('./web-scraper');
const { sendEmail } = require('./email-sender');
const { sendWhatsApp } = require('./whatsapp-notifier');
const { processDocument, searchDocuments } = require('./document-reader');
const { analyzeImage } = require('./image-analyzer');
const { generateReport } = require('./report-generator');
const { makePhoneCall } = require('./phone-caller');
const { analyzeData } = require('./data-analytics');
const { textToSpeech } = require('./voice-interface');
const { runRemoteSandbox } = require('./managed_agent_tool');
const { executeSkyvernTask } = require('./skyvern-agent');

// Registry mapping tool names to their execution functions
const toolRegistry = {
  'web_search': searchWeb,
  'web_scrape': scrapeWeb,
  'send_email': sendEmail,
  'send_whatsapp': sendWhatsApp,
  'rag_process_doc': processDocument,
  'rag_search': searchDocuments,
  'analyze_image': analyzeImage,
  'generate_report': generateReport,
  'make_phone_call': makePhoneCall,
  'analyze_data': analyzeData,
  'text_to_speech': textToSpeech,
  'run_remote_sandbox': runRemoteSandbox,
  'skyvern_fill_form': executeSkyvernTask
};

// --- Enterprise Hardening: Token Bucket Rate Limiter ---
const RATE_LIMIT_MAX = 50;
const REFILL_RATE_MS = 2000; // 1 token every 2 seconds
let currentTokens = RATE_LIMIT_MAX;
let lastRefill = Date.now();

function checkRateLimit() {
  const now = Date.now();
  const timePassed = now - lastRefill;
  const tokensToAdd = Math.floor(timePassed / REFILL_RATE_MS);
  if (tokensToAdd > 0) {
    currentTokens = Math.min(RATE_LIMIT_MAX, currentTokens + tokensToAdd);
    lastRefill = now;
  }
  if (currentTokens <= 0) return false;
  currentTokens--;
  return true;
}

// --- Enterprise Hardening: 15s Timeout Wrapper ---
const withTimeout = (promise, ms) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => clearTimeout(timeoutId));
};

/**
 * Execute a tool by name dynamically
 * @param {string} toolName - Name of the tool in registry
 * @param {object} params - Parameters to pass to the tool
 * @returns {Promise<object>} Result of the tool execution
 */
async function executeTool(toolName, params) {
  const tool = toolRegistry[toolName];
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  // 1. Rate Limiting Check
  if (!checkRateLimit()) {
    console.warn(`[RateLimiter] Execution blocked for ${toolName}. Out of tokens.`);
    return { success: false, error: 'Rate limit exceeded. Please wait.' };
  }

  console.log(`[ToolRunner] Executing ${toolName}...`);
  const startTime = Date.now();
  
  try {
    // 2. Universal Mocks Env Switch
    if (process.env.USE_MOCKS === 'true') {
      console.log(`[ToolRunner] MOCK MODE ACTIVE: Returning simulated result for ${toolName}`);
      return {
        success: true,
        toolName,
        latencyMs: 150,
        result: {
          mocked: true,
          message: `Successfully mocked execution of ${toolName}`,
          params_received: params
        }
      };
    }

    // If params is an object, expand it into arguments, otherwise pass directly
    const executionPromise = (typeof params === 'object' && !Array.isArray(params))
      ? tool(params) 
      : tool(params);
      
    // 3. 15s Timeouts on execution
    const result = await withTimeout(executionPromise, 15000);
      
    const latencyMs = Date.now() - startTime;
    console.log(`[ToolRunner] ${toolName} completed in ${latencyMs}ms`);
    
    return {
      success: true,
      toolName,
      latencyMs,
      result
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[ToolRunner] ${toolName} failed in ${latencyMs}ms: ${error.message}`);
    
    return {
      success: false,
      toolName,
      latencyMs,
      error: error.message
    };
  }
}

module.exports = {
  executeTool,
  toolRegistry,
  searchWeb,
  scrapeWeb,
  sendEmail,
  sendWhatsApp,
  processDocument,
  searchDocuments,
  analyzeImage,
  generateReport,
  makePhoneCall,
  analyzeData,
  textToSpeech,
  runRemoteSandbox,
  executeSkyvernTask
};

