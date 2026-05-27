/**
 * ⚡ AGENT ZERO - E2E LETTA EXPRESS API TESTER
 * 
 * Dynamically runs the Express server and triggers actual HTTP requests 
 * to verify all Letta memory API endpoints.
 */

const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
    console.log("=================================================");
    console.log("🚀 STARTING E2E HTTP TEST FOR LETTA ROUTE INTEGRATION");
    console.log("=================================================");

    // 1. Start the Express memory API server in the background
    console.log("Starting Express Memory API Server...");
    const serverProcess = spawn('node', [path.join(__dirname, '../memory/memory_api.js')], {
        env: { ...process.env, PORT: PORT },
        stdio: 'pipe'
    });

    // Wait for server to be ready
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
        // Give the server a small moment to bind fully
        await new Promise((r) => setTimeout(r, 1000));

        // Test Endpoint 1: Create Letta Agent
        console.log("\n🧪 [Test 1/3] POST /memory/letta/agent");
        const createResponse = await fetch(`${BASE_URL}/memory/letta/agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Agent Zero E2E Tester",
                systemPrompt: "You are a stateful validation agent."
            })
        });

        if (!createResponse.ok) {
            throw new Error(`Create Agent HTTP status: ${createResponse.status}`);
        }
        
        const createData = await createResponse.json();
        console.log("Response:", JSON.stringify(createData, null, 2));
        
        if (!createData.success || !createData.result || !createData.result.id) {
            throw new Error("Invalid response format from /memory/letta/agent");
        }
        
        const agentId = createData.result.id;
        console.log(`👉 Created Agent ID: ${agentId}`);

        // Test Endpoint 2: Send Message to Letta Agent
        console.log("\n🧪 [Test 2/3] POST /memory/letta/message");
        const msgResponse = await fetch(`${BASE_URL}/memory/letta/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: agentId,
                messageText: "Save this fact: The team lead is Mohit Gurav."
            })
        });

        if (!msgResponse.ok) {
            throw new Error(`Send Message HTTP status: ${msgResponse.status}`);
        }

        const msgData = await msgResponse.json();
        console.log("Response:", JSON.stringify(msgData, null, 2));

        if (!msgData.success || !msgData.result || !msgData.result.messages) {
            throw new Error("Invalid response format from /memory/letta/message");
        }

        // Test Endpoint 3: Fetch Letta Agent Memory
        console.log(`\n🧪 [Test 3/3] GET /memory/letta/agent/${agentId}/memory`);
        const memResponse = await fetch(`${BASE_URL}/memory/letta/agent/${agentId}/memory`);
        
        if (!memResponse.ok) {
            throw new Error(`Get Memory HTTP status: ${memResponse.status}`);
        }

        const memData = await memResponse.json();
        console.log("Response:", JSON.stringify(memData, null, 2));

        if (!memData.success || !memData.result || !memData.result.core_memory) {
            throw new Error("Invalid response format from /memory/letta/agent/:id/memory");
        }

        console.log("\n✅ ALL E2E HTTP TESTS PASSED SUCCESSFULLY!");
    } catch (err) {
        console.error("\n❌ E2E HTTP TESTS FAILED:", err.message);
        exitCode = 1;
    } finally {
        // Kill the server process gracefully
        console.log("\nStopping Express Memory API Server...");
        serverProcess.kill('SIGKILL');
        
        // Wait a small timeout on Windows to ensure OS handles are fully released
        setTimeout(() => {
            process.exit(exitCode);
        }, 500);
    }
}

runTests();
