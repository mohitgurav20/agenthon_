/**
 * ============================================================
 * AGENT ZERO — ACTION AGENT
 * ============================================================
 * Worker agent that EXECUTES tasks by calling Person B's
 * tool library on port 3000.
 *
 * Capabilities:
 *   - Send emails, WhatsApp messages, phone calls
 *   - Scrape websites, analyze images
 *   - Generate reports, run data analytics
 * ============================================================
 */

const { generateResponse } = require('../router');
const agentsConfig = require('../config/agents.json');

const TOOLS_API = process.env.TOOLS_API_URL || 'http://localhost:3000';

// Map of available tools and their API endpoints
const TOOL_ENDPOINTS = {
  send_email:      { method: 'POST', path: '/api/tools/email' },
  send_whatsapp:   { method: 'POST', path: '/api/tools/whatsapp' },
  make_phone_call: { method: 'POST', path: '/api/tools/call' },
  web_search:      { method: 'POST', path: '/api/tools/search' },
  web_scrape:      { method: 'POST', path: '/api/tools/scrape' },
  analyze_data:    { method: 'POST', path: '/api/tools/analyze-data' },
  text_to_speech:  { method: 'POST', path: '/api/tools/tts' },
};

/**
 * Use LLM to extract a structured action plan from user input
 */
async function planAction(userInput, sessionId) {
  const systemPrompt = agentsConfig.action.systemPrompt;

  const result = await generateResponse(userInput, systemPrompt, 'action', sessionId);

  try {
    const jsonMatch = result.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    throw new Error('No JSON found');
  } catch (err) {
    console.error('[ActionAgent] Failed to parse action plan:', result);
    throw new Error(`Could not understand the action request: ${userInput}`);
  }
}

/**
 * Execute a single tool call against Person B's API
 */
async function executeTool(toolName, params) {
  const endpoint = TOOL_ENDPOINTS[toolName];
  if (!endpoint) {
    return {
      success: false,
      toolName,
      error: `Unknown tool: ${toolName}. Available: ${Object.keys(TOOL_ENDPOINTS).join(', ')}`
    };
  }

  try {
    const response = await fetch(`${TOOLS_API}${endpoint.path}`, {
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    return {
      success: response.ok,
      toolName,
      result: data,
      statusCode: response.status
    };
  } catch (err) {
    return {
      success: false,
      toolName,
      error: `Tool API call failed: ${err.message}`
    };
  }
}

/**
 * Run the Action Agent — plans actions, executes tools, reports results
 */
async function run(userInput, sessionId, userId = 'agent-zero-user', complexity = 'simple') {
  console.log('[ActionAgent] Planning actions for:', userInput.substring(0, 80));

  const startTime = Date.now();

  // Step 1: Plan what tools to call
  const actionPlan = await planAction(userInput, sessionId);
  console.log(`[ActionAgent] Planned ${actionPlan.length} action(s)`);

  // Step 2: Execute all planned tools
  const results = [];
  for (const action of actionPlan) {
    console.log(`[ActionAgent] Executing: ${action.tool}`);
    const result = await executeTool(action.tool, action.params);
    results.push({
      ...result,
      explanation: action.explanation
    });
  }

  // Step 3: Summarize what happened
  const successCount = results.filter(r => r.success).length;
  const totalMs = Date.now() - startTime;

  return {
    agent: 'action',
    status: successCount === results.length ? 'success' : 'partial',
    message: `Executed ${successCount}/${results.length} actions successfully`,
    actionLogs: results,
    latencyMs: totalMs
  };
}

module.exports = { run };
