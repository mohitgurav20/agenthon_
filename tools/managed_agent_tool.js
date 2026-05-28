/**
 * ============================================================
 * TOOL 14: ATS Sandbox Parser Integration
 * ============================================================
 * Bridges the gap between the Node.js Orchestrator and the
 * secure MCP Sandbox running the Python ATS Parser.
 * ============================================================
 */

const mcpBroker = require('../mcp-broker');

async function executeAtsParser({ resumeText, jdText }) {
  console.log('[ATS Parser] Triggering secure sandbox execution...');
  
  // Escape quotes to prevent shell injection before passing to Python via CLI
  const safeResume = resumeText.replace(/"/g, '\\"').replace(/'/g, "\\'");
  const safeJd = jdText.replace(/"/g, '\\"').replace(/'/g, "\\'");
  
  // Call the Python script through the secure MCP Sandbox
  const command = `python tools/ats_parser.py "${safeResume}" "${safeJd}"`;
  
  const result = await mcpBroker.executeCommand(command);
  
  if (!result.success) {
    console.error('[ATS Parser] Sandbox Execution Failed:', result.error || result.stderr);
    return { success: false, error: 'Sandbox blocked execution or script failed.' };
  }
  
  try {
    // Python script prints JSON to stdout
    const parsedData = JSON.parse(result.stdout);
    return parsedData;
  } catch (error) {
    console.error('[ATS Parser] Failed to parse Python JSON output:', error.message);
    return { success: false, error: 'Invalid JSON output from Sandbox' };
  }
}

module.exports = { executeAtsParser };
