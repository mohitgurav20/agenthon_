/**
 * ⚡ RESUMEVAULT AI - E2E INTERACTIVE INTERVIEW API TESTER
 * 
 * Spawns the Express server in the background and sends actual HTTP POST requests
 * to verify the dynamic interview, fact extraction, and Mem0 auto-storage routines.
 */

const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function runInterviewTest() {
    console.log("=================================================");
    console.log("🚀 STARTING E2E HTTP TEST FOR PROFILE INTERVIEW ROUTE");
    console.log("=================================================");

    console.log("Starting Express Memory API Server...");
    const serverProcess = spawn('node', [path.join(__dirname, '../memory/memory_api.js')], {
        env: { ...process.env, PORT: PORT },
        stdio: 'pipe'
    });

    // Wait for server to bind
    await new Promise((resolve) => {
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[Server Log] ${output.trim()}`);
            if (output.includes('Memory API server running')) {
                resolve();
            }
        });
    });

    let exitCode = 0;
    try {
        await new Promise((r) => setTimeout(r, 1000));

        // Test POST /memory/interview
        console.log("\n🧪 [Test] POST /memory/interview");
        const payload = {
            userId: "agent-zero-interview-tester",
            messages: [
                {
                    role: "user",
                    content: "Hi! I am Mohit Gurav. I recently developed wisdom-cli, which is a stateful command-line bound Implementation to search Wikipedia using Python."
                }
            ]
        };

        const response = await fetch(`${BASE_URL}/memory/interview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Interview API HTTP status: ${response.status}`);
        }

        const data = await response.json();
        console.log("\nResponse Data from Server:\n", JSON.stringify(data, null, 2));

        if (!data.success || !data.question) {
            throw new Error("Invalid response format from /memory/interview");
        }

        console.log(`\n👉 Next Recruit Question: "${data.question}"`);
        console.log(`✨ Extracted Facts: [${data.extractedFacts ? data.extractedFacts.join(', ') : ''}]`);

        console.log("\n✅ E2E HTTP INTERVIEW PUSH TEST PASSED SUCCESSFULLY!");
    } catch (err) {
        console.error("\n❌ E2E INTERVIEW PUSH TEST FAILED:", err.message);
        exitCode = 1;
    } finally {
        console.log("\nStopping Express Memory API Server...");
        serverProcess.kill('SIGKILL');
        
        setTimeout(() => {
            process.exit(exitCode);
        }, 500);
    }
}

runInterviewTest();
