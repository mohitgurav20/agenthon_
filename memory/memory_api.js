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

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
    console.log(`Memory API server running on port ${PORT}`);
    console.log(`Endpoints available:`);
    console.log(`- POST /memory/store`);
    console.log(`- POST /memory/retrieve`);
    console.log(`- POST /memory/context`);
    console.log(`- POST /memory/letta/agent`);
    console.log(`- POST /memory/letta/message`);
    console.log(`- GET  /memory/letta/agent/:id/memory`);
    console.log(`- POST /memory/deduplicate`);
    console.log(`- POST /memory/hybrid-search`);
    console.log(`- POST /memory/reset`);
});
