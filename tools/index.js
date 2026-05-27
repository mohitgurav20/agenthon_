/**
 * ============================================================
 * AGENT ZERO — TOOLS REGISTRY
 * ============================================================
 * Person B owns this folder. All 10 tools are exported here
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
  'text_to_speech': textToSpeech
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

  console.log(`[ToolRunner] Executing ${toolName}...`);
  const startTime = Date.now();
  
  try {
    // If params is an object, expand it into arguments, otherwise pass directly
    const result = await (typeof params === 'object' && !Array.isArray(params) 
      ? tool(params) 
      : tool(params));
      
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
  textToSpeech
};
