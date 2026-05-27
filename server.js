/**
 * ============================================================
 * AGENT ZERO — API SERVER (Person B Integration Surface)
 * ============================================================
 * Express server exposing all 10 tools via REST API.
 * This allows the frontend (Day 3) to trigger them.
 * ============================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const tools = require('./tools');

const app = express.Router();


app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Basic Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- TOOL ENDPOINTS ---

// 1. Web Search
app.post('/api/tools/search', async (req, res) => {
  const { query, maxResults } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  const result = await tools.executeTool('web_search', { query, maxResults });
  res.json(result);
});

// 2. Web Scraper
app.post('/api/tools/scrape', async (req, res) => {
  const { url, task } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const result = await tools.executeTool('web_scrape', { url, task });
  res.json(result);
});

// 3. Send Email
app.post('/api/tools/email', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) return res.status(400).json({ error: 'to, subject, and body required' });
  const result = await tools.executeTool('send_email', { to, subject, body });
  res.json(result);
});

// 4. WhatsApp
app.post('/api/tools/whatsapp', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'to and message required' });
  const result = await tools.executeTool('send_whatsapp', { to, message });
  res.json(result);
});

// 5. Phone Call (Nuclear Option)
app.post('/api/tools/call', async (req, res) => {
  const { phoneNumber, task } = req.body;
  if (!phoneNumber || !task) return res.status(400).json({ error: 'phoneNumber and task required' });
  const result = await tools.executeTool('make_phone_call', { phoneNumber, task });
  res.json(result);
});

// 6. Data Analytics
app.post('/api/tools/analyze-data', async (req, res) => {
  const { table, query, analysisType } = req.body;
  if (!table) return res.status(400).json({ error: 'table is required' });
  const result = await tools.executeTool('analyze_data', { table, query, analysisType });
  res.json(result);
});

// 7. Text to Speech
app.post('/api/tools/tts', async (req, res) => {
  const { text, voiceId } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const result = await tools.executeTool('text_to_speech', { text, voiceId });
  res.json(result);
});

// 8. Skyvern Webhook
app.post('/api/webhooks/skyvern', (req, res) => {
  const payload = req.body;
  console.log(`[Webhook] Received Skyvern status update for Task ID: ${payload.task_id}`);
  
  // Here we would typically save the status to Supabase or alert the Agent via MCP
  // For the hackathon, we simply acknowledge it to prevent Skyvern from retrying.
  console.log(`[Webhook] Status: ${payload.status}`);
  
  res.status(200).send('OK');
});

module.exports = app;
