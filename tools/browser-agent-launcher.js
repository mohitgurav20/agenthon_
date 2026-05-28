/**
 * ============================================================
 * TOOL 15: Browser Agent Launcher (Human-in-the-loop)
 * ============================================================
 * Wraps the execution of python_browser_agent.py to safely
 * detect CAPTCHAs and emit resilient pauses back to the UI.
 * ============================================================
 */

const { exec } = require('child_process');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

async function launchBrowserAgent(url, task) {
  try {
    console.log(`[BrowserLauncher] Spawning secure browser agent for ${url}...`);
    const scriptPath = path.join(__dirname, 'python_browser_agent.py');
    
    // Execute python script
    const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${url}" "${task}"`, {
      timeout: 120000 // 2 minutes max
    });

    if (stderr && !stdout) {
      console.warn(`[BrowserLauncher] Python stderr: ${stderr}`);
    }

    // Check for Human-in-the-Loop flag
    if (stdout.includes('HUMAN_INTERVENTION_REQUIRED')) {
      console.warn(`[BrowserLauncher] 🚨 CAPTCHA/2FA DETECTED! Emitting Safety Pause.`);
      return {
        success: false,
        status: 'safety_pause',
        message: 'A security check requires human intervention. Please open the Chromium window, solve the CAPTCHA, and re-trigger the workflow.'
      };
    }

    let result;
    try {
      // Find the JSON block in the stdout in case python printed other logs
      const jsonStr = stdout.substring(stdout.indexOf('{'));
      result = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Invalid JSON output: ${stdout}`);
    }

    return result;

  } catch (error) {
    if (error.stdout && error.stdout.includes('HUMAN_INTERVENTION_REQUIRED')) {
       return {
        success: false,
        status: 'safety_pause',
        message: 'A security check requires human intervention. Please solve it in the browser.'
      };
    }
    
    console.error(`[BrowserLauncher] Execution failed: ${error.message}`);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

module.exports = { launchBrowserAgent };
