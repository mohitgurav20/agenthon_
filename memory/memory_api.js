require('dotenv').config();
const express = require('express');
const { 
    storeMemory, 
    retrieveMemory, 
    buildContext, 
    createLettaAgent, 
    sendLettaMessage, 
    getLettaAgentMemory 
} = require('./index');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Endpoint to store memory in Mem0
app.post('/memory/store', async (req, res) => {
    try {
        const { text, userId } = req.body;
        if (!text || !userId) {
            return res.status(400).json({ error: "Missing 'text' or 'userId' in request body." });
        }
        
        const result = await storeMemory(text, userId);
        res.json({ success: true, result });
    } catch (error) {
        console.error("Error in /memory/store:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to retrieve memory from Mem0
app.post('/memory/retrieve', async (req, res) => {
    try {
        const { query, userId } = req.body;
        if (!query || !userId) {
            return res.status(400).json({ error: "Missing 'query' or 'userId' in request body." });
        }
        
        const results = await retrieveMemory(query, userId);
        res.json({ success: true, results });
    } catch (error) {
        console.error("Error in /memory/retrieve:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Endpoint to build combined context (Mem0 + Supabase RAG)
app.post('/memory/context', async (req, res) => {
    try {
        const { query, userId } = req.body;
        if (!query || !userId) {
            return res.status(400).json({ error: "Missing 'query' or 'userId' in request body." });
        }
        
        const contextString = await buildContext(query, userId);
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

app.listen(PORT, () => {
    console.log(`Memory API server running on port ${PORT}`);
    console.log(`Endpoints available:`);
    console.log(`- POST /memory/store`);
    console.log(`- POST /memory/retrieve`);
    console.log(`- POST /memory/context`);
    console.log(`- POST /memory/letta/agent`);
    console.log(`- POST /memory/letta/message`);
    console.log(`- GET  /memory/letta/agent/:id/memory`);
});
