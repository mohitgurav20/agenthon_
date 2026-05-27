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
const { validateEnv } = require('./envValidator');
validateEnv(); // Verify environmental parameters before startup

const express = require('express');
const cors = require('cors');
const { processInput } = require('./index');
const { flush } = require('./langfuse');
const { getSessionSummary, getGlobalSummary } = require('./services/auditor');
const { getActiveModels, setActiveModels, MODELS } = require('./router');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3002;

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

app.use(cors());
app.use(express.json());

// ── Diagnostics Health Check ──
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  const TOOLS_API = process.env.TOOLS_API_URL || 'http://localhost:3000';
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';

  // Helper to ping an HTTP endpoint and measure latency
  async function pingService(url) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return { status: r.ok ? 'online' : 'degraded', latencyMs: Date.now() - t0, statusCode: r.status };
    } catch (err) {
      return { status: 'offline', latencyMs: Date.now() - t0, error: err.message };
    }
  }

  // Helper to ping Supabase DB
  async function pingDatabase() {
    const t0 = Date.now();
    try {
      if (!supabase) return { status: 'not_configured', latencyMs: 0 };
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) return { status: 'degraded', latencyMs: Date.now() - t0, error: error.message };
      return { status: 'online', latencyMs: Date.now() - t0 };
    } catch (err) {
      return { status: 'offline', latencyMs: Date.now() - t0, error: err.message };
    }
  }

  // Run all health pings in parallel
  const [toolsHealth, memoryHealth, dbHealth] = await Promise.all([
    pingService(`${TOOLS_API}/api/health`),
    pingService(`${MEMORY_API}/memory/store`).then(r => ({ ...r, note: 'ping only' })).catch(() => ({ status: 'offline', latencyMs: 0 })),
    pingDatabase()
  ]);

  // Gather system metrics
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPct = (((totalMem - freeMem) / totalMem) * 100).toFixed(1);
  const cpus = os.cpus();
  const avgLoad = cpus.reduce((sum, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return sum + ((total - cpu.times.idle) / total) * 100;
  }, 0) / cpus.length;

  const overallStatus =
    dbHealth.status === 'online' ? 'healthy' :
    dbHealth.status === 'degraded' ? 'degraded' : 'unhealthy';

  res.json({
    service: 'agent-zero-orchestrator',
    status: overallStatus,
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    serverLatencyMs: Date.now() - startTime,
    ports: {
      orchestrator: PORT,
      toolsApi: TOOLS_API,
      memoryApi: MEMORY_API
    },
    dependencies: {
      database: dbHealth,
      toolsApi: toolsHealth,
      memoryApi: memoryHealth
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: `${Math.floor(process.uptime())}s`,
      cpuCores: cpus.length,
      cpuUsagePct: avgLoad.toFixed(1) + '%',
      memoryTotalMB: Math.round(totalMem / 1024 / 1024),
      memoryFreeMB: Math.round(freeMem / 1024 / 1024),
      memoryUsedPct: usedMemPct + '%'
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

// ── Token & Cost Auditor Endpoints ──
app.get('/api/audit/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  res.json(getSessionSummary(sessionId));
});

app.get('/api/audit/summary', (req, res) => {
  res.json(getGlobalSummary());
});

// ── LLM Runtime Dynamic Switcher Endpoints ──
app.get('/api/models/active', (req, res) => {
  res.json(getActiveModels());
});

app.post('/api/models/active', (req, res) => {
  setActiveModels(req.body);
  res.json({ success: true, activeModels: getActiveModels() });
});

app.get('/api/models/available', (req, res) => {
  res.json(MODELS);
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
╔══════════════════════════════════════════════════════╗
║  ⚡ AGENT ZERO — ORCHESTRATOR  v2.0.0               ║
║  Running on http://localhost:${PORT}                    ║
║                                                      ║
║  POST /api/orchestrate                               ║
║  GET  /api/health              [Diagnostics]         ║
║  GET  /api/audit/summary       [Token & Cost]        ║
║  GET  /api/audit/session/:id   [Session Audit]       ║
║  GET  /api/models/active       [LLM Switcher]        ║
║  POST /api/models/active       [LLM Switcher]        ║
║  GET  /api/models/available    [Model Registry]      ║
║  GET  /.well-known/agent.json  [A2A Card]            ║
║  POST /api/a2a                 [JSON-RPC 2.0]        ║
║                                                      ║
║  Tools API:  ${(process.env.TOOLS_API_URL || 'http://localhost:3000').padEnd(38)}║
║  Memory API: ${(process.env.MEMORY_API_URL || 'http://localhost:3001').padEnd(38)}║
╚══════════════════════════════════════════════════════╝
  `);
});
