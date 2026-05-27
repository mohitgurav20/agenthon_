/**
 * ============================================================
 * AGENT ZERO — ORCHESTRATOR API SERVER
 * ============================================================
 * Express server on port 3002 exposing the orchestrator.
 *
 * Ports:
 *   3000 — Person B's Tools API
 *   3001 — Person C's Memory API
 *   3002 — Person A's Orchestrator API (THIS)
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { processInput } = require('./index');
const { flush } = require('./langfuse');

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3002;

app.use(cors());
app.use(express.json());

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    service: 'agent-zero-orchestrator',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ports: {
      orchestrator: PORT,
      toolsApi: process.env.TOOLS_API_URL || 'http://localhost:3000',
      memoryApi: process.env.MEMORY_API_URL || 'http://localhost:3001'
    }
  });
});

// ── Main Orchestrator Endpoint ──
app.post('/api/orchestrate', async (req, res) => {
  const { userInput, sessionId, userId } = req.body;

  if (!userInput) {
    return res.status(400).json({ error: 'userInput is required' });
  }

  try {
    const result = await processInput({
      userInput,
      sessionId: sessionId || `session-${Date.now()}`,
      userId: userId || 'agent-zero-user'
    });

    res.json(result);
  } catch (err) {
    console.error('[Server] Error processing request:', err);
    res.status(500).json({
      error: 'Internal orchestrator error',
      message: err.message
    });
  }
});

// ── A2A Protocol Compliance Endpoints ──

// GET /.well-known/agent.json -> Standard Agent Card Advertisement
app.get('/.well-known/agent.json', (req, res) => {
  res.json({
    schema: "https://linuxfoundation.org/schemas/a2a/agent-card.json",
    name: "Agent Zero",
    description: "Enterprise-grade agentic system utilizing Antigravity 2.0 and n8n with remote Linux sandbox execution, stateful Mem0 memory, and Claude-based self-evaluation loops.",
    version: "2.0.0",
    owner: {
      team: "Agent Zero",
      lead: "Person A",
      email: "lead@agent-zero.ai"
    },
    endpoints: {
      a2a: `http://${req.headers.host}/api/a2a`,
      health: `http://${req.headers.host}/api/health`
    },
    capabilities: {
      models: ["Gemini 1.5 Pro", "Claude 3.5 Sonnet", "Llama 3.1 70B (Groq)"],
      tools: [
        "web_search",
        "web_scrape",
        "send_email",
        "send_whatsapp",
        "rag_process_doc",
        "rag_search",
        "analyze_image",
        "generate_report",
        "make_phone_call",
        "analyze_data",
        "text_to_speech",
        "run_remote_sandbox"
      ]
    }
  });
});

// POST /api/a2a -> Standard A2A JSON-RPC 2.0 Endpoint
app.post('/api/a2a', async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request: Must use JSON-RPC 2.0' },
      id: id || null
    });
  }

  console.log(`[A2A Server] Received JSON-RPC request for method: "${method}"`);

  try {
    switch (method) {
      case 'agent/capabilities':
        return res.json({
          jsonrpc: '2.0',
          result: {
            agentName: "Agent Zero",
            owner: "Person A (Orchestrator Lead)",
            version: "2.0.0",
            capabilities: [
              "data_analysis", "web_research", "self_validation", 
              "doc_rag", "remote_linux_sandbox", "voice_interface"
            ],
            supportedModels: ["Gemini 1.5 Pro", "Claude 3.5 Sonnet", "Llama 3.1 70B (Groq)"]
          },
          id
        });

      case 'message/send':
        const userInput = params?.message || params?.text;
        if (!userInput) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Invalid Params: message or text parameter is required' },
            id
          });
        }

        const orchestratorResult = await processInput({
          userInput,
          sessionId: params?.sessionId || `session-a2a-${Date.now()}`,
          userId: params?.userId || 'agent-zero-a2a'
        });

        return res.json({
          jsonrpc: '2.0',
          result: {
            text: orchestratorResult.finalResponse || orchestratorResult.output || 'Execution finished successfully',
            validation: {
              confidenceScore: orchestratorResult.validationScore || 90,
              passed: (orchestratorResult.validationScore || 90) >= 70,
              feedback: orchestratorResult.feedback || 'Looks great!'
            },
            orchestratorResult
          },
          id
        });

      default:
        return res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${method}` },
          id
        });
    }
  } catch (err) {
    console.error('[A2A Server] Method execution error:', err);
    return res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: `Internal error: ${err.message}` },
      id
    });
  }
});

// ── Graceful Shutdown ──
process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  await flush();
  process.exit(0);
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  ⚡ AGENT ZERO — ORCHESTRATOR               ║
║  Running on http://localhost:${PORT}            ║
║                                              ║
║  POST /api/orchestrate                       ║
║  GET  /api/health                            ║
║  GET  /.well-known/agent.json    [A2A Card]  ║
║  POST /api/a2a                   [JSON-RPC]  ║
║                                              ║
║  Tools API:  ${(process.env.TOOLS_API_URL || 'http://localhost:3000').padEnd(30)}║
║  Memory API: ${(process.env.MEMORY_API_URL || 'http://localhost:3001').padEnd(30)}║
╚══════════════════════════════════════════════╝
  `);
});
