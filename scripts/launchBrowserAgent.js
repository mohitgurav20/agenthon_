const { spawn } = require('child_process');
const path = require('path');

/**
 * ⚡ AGENT ZERO - SKYVERN BROWSER-USE AGENT LAUNCHER
 * 
 * Safely spawns the Python-based Skyvern/Browser-use agent inside a Docker sandbox.
 * Enforces strict headless execution to prevent crashes on local environments where
 * a display server (X11/Wayland) is not available.
 * 
 * @param {string} taskDescription - The natural language task for the browser agent
 * @param {string} targetUrl - The starting URL for the task
 * @returns {Promise<Object>} The agent's structured JSON output
 */
async function launchBrowserAgent(taskDescription, targetUrl) {
    if (!taskDescription || !targetUrl) {
        throw new Error("Missing taskDescription or targetUrl");
    }

    console.log(`\n🌐 [BrowserAgent] Launching headless browser agent for task: "${taskDescription}"`);
    console.log(`[BrowserAgent] Target URL: ${targetUrl}`);

    return new Promise((resolve, reject) => {
        // Path to the python agent script (assuming it exists or will be created in the same directory)
        const pythonScriptPath = path.join(__dirname, 'skyvern_agent.py');

        // Set strict headless environment variables
        const env = {
            ...process.env,
            HEADLESS: 'true',
            DISPLAY: '', // Unset display to force headless mode
            XVFB: '1',   // Use Xvfb if necessary
            SKYVERN_HEADLESS: '1'
        };

        const pythonProcess = spawn('python3', [
            pythonScriptPath,
            '--task', taskDescription,
            '--url', targetUrl,
            '--headless'
        ], { env });

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
            // Optional: console.error(`[BrowserAgent:err] ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`[BrowserAgent] ❌ Process exited with code ${code}`);
                console.error(`[BrowserAgent] STDERR:\n${stderrData}`);
                return reject(new Error(`Browser agent failed with code ${code}`));
            }

            try {
                console.log(`[BrowserAgent] ✅ Execution completed successfully.`);
                // Attempt to parse the stdout as JSON if the agent outputs structured data
                // In many cases, it might output logs followed by JSON. We try to find the JSON block.
                const jsonStart = stdoutData.indexOf('{');
                const jsonEnd = stdoutData.lastIndexOf('}');
                
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const jsonString = stdoutData.substring(jsonStart, jsonEnd + 1);
                    const result = JSON.parse(jsonString);
                    resolve(result);
                } else {
                    // Fallback: return raw output
                    resolve({ rawOutput: stdoutData.trim() });
                }
            } catch (err) {
                console.error(`[BrowserAgent] ⚠️ Failed to parse agent output as JSON. Return raw.`);
                resolve({ rawOutput: stdoutData.trim(), parseError: err.message });
            }
        });
        
        pythonProcess.on('error', (err) => {
            console.error(`[BrowserAgent] ❌ Failed to spawn Python process:`, err.message);
            reject(err);
        });
    });
}

// Allow CLI execution for testing
if (require.main === module) {
    const args = process.argv.slice(2);
    const task = args[0] || "Extract ATS keywords from the job description";
    const url = args[1] || "https://example.com/job/123";
    
    launchBrowserAgent(task, url)
        .then(res => console.log("\nFINAL AGENT OUTPUT:\n", JSON.stringify(res, null, 2)))
        .catch(console.error);
}

module.exports = { launchBrowserAgent };
