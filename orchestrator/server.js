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
║                                              ║
║  Tools API:  ${(process.env.TOOLS_API_URL || 'http://localhost:3000').padEnd(30)}║
║  Memory API: ${(process.env.MEMORY_API_URL || 'http://localhost:3001').padEnd(30)}║
╚══════════════════════════════════════════════╝
  `);
});
