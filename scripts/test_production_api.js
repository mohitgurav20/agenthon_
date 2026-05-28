/**
 * ⚡ AGENT ZERO - E2E PRODUCTION READINESS API TESTER
 * 
 * Spawns the Express server and executes actual HTTP calls to validate
 * the production reset, deduplicate, and hybrid-search endpoints.
 */

const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function runProductionTests() {
    console.log("=================================================");
    console.log("🚀 AGENT ZERO - E2E PRODUCTION API VERIFICATION RUN");
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
            console.log(`[Server] ${output.trim()}`);
            if (output.includes('Memory API server running')) {
                resolve();
            }
        });
    });

    let exitCode = 0;
    try {
        await new Promise((r) => setTimeout(r, 1000));

        // 1. Test Endpoint: Hybrid Search
        console.log("\n🧪 [Test 1/3] POST /memory/hybrid-search");
        const searchRes = await fetch(`${BASE_URL}/memory/hybrid-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: "Agent Zero",
                matchThreshold: 0.3,
                matchCount: 3
            })
        });

        if (!searchRes.ok) {
            throw new Error(`Hybrid Search status: ${searchRes.status}`);
        }
        const searchData = await searchRes.json();
        console.log("Response:", JSON.stringify(searchData, null, 2));

        if (!searchData.success || !searchData.results) {
            throw new Error("Invalid response schema from /memory/hybrid-search");
        }

        // 2. Test Endpoint: Memory Deduplication
        console.log("\n🧪 [Test 2/3] POST /memory/deduplicate");
        const dedupRes = await fetch(`${BASE_URL}/memory/deduplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: "agent-zero-user"
            })
        });

        if (!dedupRes.ok) {
            throw new Error(`Deduplication status: ${dedupRes.status}`);
        }
        const dedupData = await dedupRes.json();
        console.log("Response:", JSON.stringify(dedupData, null, 2));

        if (!dedupData.success || !dedupData.result) {
            throw new Error("Invalid response schema from /memory/deduplicate");
        }

        // 3. Test Endpoint: Mem0 Multi-User Profile Clustering
        console.log("\n🧪 [Test 3/4] POST /memory/store & /memory/retrieve (Profile Clustering)");
        
        console.log("Storing fact into '#user-preferences' cluster...");
        const storePrefRes = await fetch(`${BASE_URL}/memory/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: "Mohit Gurav prefers high-contrast dark theme UI layouts.",
                userId: "agent-zero-cluster-test",
                cluster: "user-preferences"
            })
        });
        if (!storePrefRes.ok) throw new Error("Failed to store preference memory.");
        
        console.log("Storing fact into '#teammate-facts' cluster...");
        const storeTeammateRes = await fetch(`${BASE_URL}/memory/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: "Mohit Gurav is the primary team lead.",
                userId: "agent-zero-cluster-test",
                cluster: "teammate-facts"
            })
        });
        if (!storeTeammateRes.ok) throw new Error("Failed to store teammate memory.");

        console.log("Querying memories strictly scoped to 'user-preferences'...");
        const retrievePrefRes = await fetch(`${BASE_URL}/memory/retrieve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: "Mohit Gurav",
                userId: "agent-zero-cluster-test",
                cluster: "user-preferences"
            })
        });
        if (!retrievePrefRes.ok) throw new Error("Failed to retrieve scoped preference memories.");
        const prefData = await retrievePrefRes.json();
        console.log("Scoped 'user-preferences' results:", JSON.stringify(prefData, null, 2));

        console.log("Querying memories strictly scoped to 'teammate-facts'...");
        const retrieveTeammateRes = await fetch(`${BASE_URL}/memory/retrieve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: "Mohit Gurav",
                userId: "agent-zero-cluster-test",
                cluster: "teammate-facts"
            })
        });
        if (!retrieveTeammateRes.ok) throw new Error("Failed to retrieve scoped teammate memories.");
        const teammateData = await retrieveTeammateRes.json();
        console.log("Scoped 'teammate-facts' results:", JSON.stringify(teammateData, null, 2));

        // 4. Test Endpoint: Reset / Purge
        console.log("\n🧪 [Test 4/4] POST /memory/reset");
        const resetRes = await fetch(`${BASE_URL}/memory/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: "agent-zero-temp-user"
            })
        });

        if (!resetRes.ok) {
            throw new Error(`Reset status: ${resetRes.status}`);
        }
        const resetData = await resetRes.json();
        console.log("Response:", JSON.stringify(resetData, null, 2));

        if (!resetData.success) {
            throw new Error("Invalid response schema from /memory/reset");
        }

        console.log("\n🎉 ALL E2E PRODUCTION READINESS TESTS COMPLETED WITH 100% SUCCESS!");
    } catch (err) {
        console.error("\n❌ PRODUCTION TESTS FAILED:", err.message);
        exitCode = 1;
    } finally {
        console.log("\nStopping Express Memory API Server...");
        serverProcess.kill('SIGKILL');
        
        setTimeout(() => {
            process.exit(exitCode);
        }, 500);
    }
}

runProductionTests();
