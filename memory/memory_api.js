require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { 
    storeMemory, 
    retrieveMemory, 
    buildContext, 
    createLettaAgent, 
    sendLettaMessage, 
    getLettaAgentMemory 
} = require('./index');
const { searchKnowledgeBase } = require('../scripts/rag_pipeline');

// Initialize local Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express.Router();
app.use(express.json());

const PORT = process.env.MEMORY_PORT || 3001;

// Endpoint to store memory in Mem0
app.post('/memory/store', async (req, res) => {
    try {
        const { text, userId, cluster } = req.body;
        if (!text || !userId) {
            return res.status(400).json({ error: "Missing 'text' or 'userId' in request body." });
        }
        
        const result = await storeMemory(text, userId, cluster);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/store:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to retrieve memory from Mem0
app.post('/memory/retrieve', async (req, res) => {
    try {
        const { query, userId, cluster } = req.body;
        if (!query || !userId) {
            return res.status(400).json({ error: "Missing 'query' or 'userId' in request body." });
        }
        
        const results = await retrieveMemory(query, userId, cluster);
        res.json({ success: true, results });
    } catch (error) {
        console.error("Error in /memory/retrieve:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to build combined context (Mem0 + Supabase RAG)
app.post('/memory/context', async (req, res) => {
    try {
        const { query, userId, cluster } = req.body;
        if (!query || !userId) {
            return res.status(400).json({ error: "Missing 'query' or 'userId' in request body." });
        }
        
        const contextString = await buildContext(query, userId, cluster);
        res.json({ success: true, context: contextString });
    } catch (error) {
        console.error("Error in /memory/context:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to create a Letta agent
app.post('/memory/letta/agent', async (req, res) => {
    try {
        const { name, systemPrompt } = req.body;
        if (!name || !systemPrompt) {
            return res.status(400).json({ error: "Missing 'name' or 'systemPrompt' in request body." });
        }
        
        const result = await createLettaAgent(name, systemPrompt);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/letta/agent:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to send message to a Letta agent
app.post('/memory/letta/message', async (req, res) => {
    try {
        const { agentId, messageText } = req.body;
        if (!agentId || !messageText) {
            return res.status(400).json({ error: "Missing 'agentId' or 'messageText' in request body." });
        }
        
        const result = await sendLettaMessage(agentId, messageText);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/letta/message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to get Letta agent memory
app.get('/memory/letta/agent/:id/memory', async (req, res) => {
    try {
        const agentId = req.params.id;
        if (!agentId) {
            return res.status(400).json({ error: "Missing agent 'id' parameter." });
        }
        
        const result = await getLettaAgentMemory(agentId);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/letta/agent/:id/memory:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to conduct a dynamic step in the ResumeVault Interview
app.post('/memory/interview', async (req, res) => {
    try {
        const { messages, userId } = req.body;
        if (!messages || !Array.isArray(messages) || !userId) {
            return res.status(400).json({ error: "Missing 'messages' (Array) or 'userId' (String) in request body." });
        }
        
        const { conductInterviewStep } = require('../scripts/profile_builder');
        const result = await conductInterviewStep(messages, userId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Error in /memory/interview:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to trigger semantic memory deduplication
app.post('/memory/deduplicate', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "Missing 'userId' in request body." });
        }
        
        const { deduplicateUserMemories } = require('../scripts/deduplicate_memories');
        const result = await deduplicateUserMemories(userId);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/deduplicate:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to query RAG using Reciprocal Rank Fusion Hybrid search
app.post('/memory/hybrid-search', async (req, res) => {
    try {
        const { query, matchThreshold, matchCount } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Missing 'query' in request body." });
        }
        
        const results = await searchKnowledgeBase(query, matchThreshold || 0.3, matchCount || 5, 'hybrid');
        res.json({ success: true, results });
    } catch (error) {
        console.error("Error in /memory/hybrid-search:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to purge and reset all database tables between hackathon runs
app.post('/memory/reset', async (req, res) => {
    try {
        console.log("🧹 [API Reset] Purging database tables...");
        
        // Delete items. To secure safety across Supabase policies, we check not-null ids
        const d1 = await supabase.from('tool_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const d2 = await supabase.from('agent_outputs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const d3 = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (d1.error || d2.error || d3.error) {
            console.warn("⚠️  Some tables failed to purge or had no rows:", {
                tool_logs: d1.error?.message || 'OK',
                agent_outputs: d2.error?.message || 'OK',
                documents: d3.error?.message || 'OK'
            });
        }

        const { userId } = req.body;
        if (userId) {
            console.log(`Resetting Mem0 user memories for ID: ${userId}...`);
            const isOnline = process.env.MEM0_API_KEY && !process.env.MEM0_API_KEY.includes('your_');
            if (isOnline) {
                const { MemoryClient } = require('mem0ai');
                const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
                await client.deleteAll({ userId });
            } else {
                console.log("ℹ️  [API Reset] Mem0 API key is not configured. Simulating memory purge.");
            }
        }

        res.json({ 
            success: true, 
            message: "Database tables and conversational contexts cleared successfully." 
        });
    } catch (error) {
        console.log("Error in /memory/reset:", error.message, error.stack);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ═══════════════════════════════════════════════════════════════
//  🆕 SCHEDULED DEDUPLICATION SYSTEM (Task 2)
// ═══════════════════════════════════════════════════════════════

const DEDUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let dedupSchedulerHandle = null;
let dedupSchedulerState = {
    running: false,
    lastRunAt: null,
    lastResult: null,
    runCount: 0,
    intervalMs: DEDUP_INTERVAL_MS
};

/**
 * Runs a single deduplication pass for the default user.
 */
async function runDeduplicationPass() {
    const userId = process.env.MEM0_DEFAULT_USER_ID || 'agent-zero-user';
    console.log(`\n⏰ [Scheduler] Running deduplication pass for user "${userId}"...`);
    
    try {
        const { deduplicateUserMemories } = require('../scripts/deduplicate_memories');
        const result = await deduplicateUserMemories(userId);
        
        dedupSchedulerState.lastRunAt = new Date().toISOString();
        dedupSchedulerState.lastResult = result;
        dedupSchedulerState.runCount++;
        
        console.log(`⏰ [Scheduler] Pass #${dedupSchedulerState.runCount} complete. Before: ${result.beforeCount}, After: ${result.afterCount}`);
        return result;
    } catch (error) {
        console.error(`⏰ [Scheduler] Deduplication pass failed:`, error.message);
        dedupSchedulerState.lastRunAt = new Date().toISOString();
        dedupSchedulerState.lastResult = { error: error.message };
        return { success: false, error: error.message };
    }
}

/**
 * Starts the background deduplication scheduler.
 */
function startDeduplicationScheduler() {
    if (dedupSchedulerHandle) {
        console.log("⏰ [Scheduler] Already running. Skipping duplicate start.");
        return;
    }

    console.log(`⏰ [Scheduler] Starting deduplication scheduler (every ${DEDUP_INTERVAL_MS / 1000}s)...`);
    dedupSchedulerState.running = true;

    // Run first pass after a 30-second warm-up delay
    setTimeout(() => {
        runDeduplicationPass();
    }, 30000);

    // Then run every 10 minutes
    dedupSchedulerHandle = setInterval(() => {
        runDeduplicationPass();
    }, DEDUP_INTERVAL_MS);
}

// GET scheduler status
app.get('/memory/scheduler/status', (req, res) => {
    res.json({
        success: true,
        scheduler: dedupSchedulerState
    });
});

// POST manual trigger for deduplication
app.post('/memory/scheduler/trigger', async (req, res) => {
    try {
        const result = await runDeduplicationPass();
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/scheduler/trigger:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ═══════════════════════════════════════════════════════════════
//  🆕 PGBOUNCER POOL HEALTH (Task 3)
// ═══════════════════════════════════════════════════════════════

app.get('/memory/pool/health', async (req, res) => {
    try {
        const { checkPoolHealth } = require('../scripts/db_pool');
        const health = checkPoolHealth();
        res.json({ success: true, pool: health });
    } catch (error) {
        // db_pool.js might not exist yet during incremental development
        res.json({ 
            success: true, 
            pool: { status: 'not_configured', message: 'db_pool.js not loaded' }
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  🆕 CULTURE CHEAT-SHEET ENDPOINT (Task 4)
// ═══════════════════════════════════════════════════════════════

app.post('/memory/culture-card', async (req, res) => {
    try {
        const { companyName, jobDescription } = req.body;
        if (!companyName || !jobDescription) {
            return res.status(400).json({ error: "Missing 'companyName' or 'jobDescription' in request body." });
        }

        const { generateCultureCard } = require('../scripts/culture_cheatsheet');
        const card = await generateCultureCard(companyName, jobDescription);
        res.json({ success: true, card });
    } catch (error) {
        console.error("Error in /memory/culture-card:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ═══════════════════════════════════════════════════════════════
//  🔍 SEMANTIC GAP ANALYSIS ENDPOINT (Missed MVP Task)
// ═══════════════════════════════════════════════════════════════

app.post('/memory/gap-analysis', async (req, res) => {
    try {
        const { jobDescription, candidateId } = req.body;
        if (!jobDescription) {
            return res.status(400).json({ error: "Missing 'jobDescription' in request body." });
        }

        const { generateGapAnalysis } = require('../scripts/gap_analysis');
        const report = await generateGapAnalysis(jobDescription, candidateId);
        res.json({ success: true, report });
    } catch (error) {
        console.error("Error in /memory/gap-analysis:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Auto-start the deduplication scheduler
startDeduplicationScheduler();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 [Shutdown] SIGTERM received. Cleaning up...');
    if (dedupSchedulerHandle) {
        clearInterval(dedupSchedulerHandle);
        dedupSchedulerState.running = false;
        console.log('⏰ [Scheduler] Stopped.');
    }
    try {
        const { shutdownPool } = require('../scripts/db_pool');
        shutdownPool();
    } catch (e) { /* db_pool may not be loaded */ }
    process.exit(0);
});

module.exports = app;

