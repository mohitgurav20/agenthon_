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
const { generateReport, generateSummary, generateResume } = require('../tools/report-generator');
const { getSessionSummary, getGlobalSummary } = require('./services/auditor');
const { getActiveModels, setActiveModels, MODELS, generateResponse } = require('./router');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const ws = require('ws');

// Polyfill WebSocket for Supabase Realtime in Node 20
global.WebSocket = ws;

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 3002;

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Integrate all backend services into one unified port for maximum speed
const toolsApi = require('../server');
const memoryApi = require('../memory/memory_api');

app.use('/', toolsApi);
app.use('/', memoryApi);

// Friendly root route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Agent Zero API Monolith',
    message: 'System is fully operational. Proceed to the frontend dashboard.'
  });
});

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
  // Since we merged everything into one port, we check internal services on the same port!
  const [toolsHealth, memoryHealth, dbHealth] = await Promise.all([
    pingService(`http://localhost:${PORT}/api/tools/health`),
    pingService(`http://localhost:${PORT}/memory/store`).then(r => ({ ...r, note: 'ping only' })).catch(() => ({ status: 'offline', latencyMs: 0 })),
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

// GET /api/profile/milestones -> Expose current Mem0 career milestones to frontend
app.get('/api/profile/milestones', async (req, res) => {
  const userId = req.query.userId || 'agent-zero-user';
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${MEMORY_API}/memory/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'skills projects achievements experiences education profile about', userId })
    });
    if (!response.ok) throw new Error(`Memory API returned ${response.status}`);
    const data = await response.json();
    
    // Parse Mem0 results into the Milestone format
    const results = data.results || data.result || [];
    const milestones = results.map((item, idx) => {
      const text = item.memory || item.content || item.text || JSON.stringify(item);
      
      // Clean up text
      let category = 'Project';
      if (/react|node|javascript|python|java|go|rust|c\+\+|html|css|typescript|sql/i.test(text)) {
        category = 'Language';
      } else if (/supabase|postgres|mysql|redis|mongodb|database/i.test(text)) {
        category = 'Database';
      } else if (/docker|kubernetes|aws|git|pipeline|ci\/cd|mem0/i.test(text)) {
        category = 'Framework';
      }
      
      let title = text.split(' ').slice(0, 3).join(' ');
      if (title.length > 20) title = title.substring(0, 20) + '...';
      
      return {
        id: item.id || idx.toString(),
        title,
        category,
        desc: text
      };
    });
    
    // If empty, return standard fallbacks
    if (milestones.length === 0) {
      return res.json([
        { id: "1", title: "React & Node.js", category: "Language", desc: "Core stack for full-stack interface development." },
        { id: "2", title: "Supabase pgvector", category: "Database", desc: "Built 3072-dimensional vector embedding search table." },
        { id: "3", title: "Mem0 Memory", category: "State", desc: "Configured persistent episodic context profiles." }
      ]);
    }
    
    res.json(milestones);
  } catch (err) {
    console.error('[Server] Failed to fetch milestones:', err.message);
    res.json([
      { id: "1", title: "React & Node.js", category: "Language", desc: "Core stack for full-stack interface development." },
      { id: "2", title: "Supabase pgvector", category: "Database", desc: "Built 3072-dimensional vector embedding search table." },
      { id: "3", title: "Mem0 Memory", category: "State", desc: "Configured persistent episodic context profiles." }
    ]);
  }
});

// GET /api/portfolio/generate -> Expose dynamic visual web portfolio compiler endpoint
app.get('/api/portfolio/generate', async (req, res) => {
  const userId = req.query.userId || 'agent-zero-user';
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
  try {
    const fs = require('fs');
    const path = require('path');

    // 1. Retrieve all facts/milestones from Mem0
    let memories = [];
    try {
      const response = await fetch(`${MEMORY_API}/memory/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'skills, projects, certifications, experiences, milestones', userId })
      });
      if (response.ok) {
        const data = await response.json();
        memories = data.results || data.result || [];
      }
    } catch (err) {
      console.warn('[PortfolioGen] Failed to fetch live Mem0 milestones:', err.message);
    }

    // Default milestones if none exist
    if (memories.length === 0) {
      memories = [
        { memory: "Skills: Demonstrated production expertise in React, Node.js, Next.js, and TypeScript." },
        { memory: "Project: Built 'FLUX AI' - career command center with 95% stars on GitHub." },
        { memory: "Milestone: Deployed autonomous container sandbox ATS simulator and validator feedback loop." },
        { memory: "Project: Integrated Supabase pgvector hybrid search index (3072 dimensions) with Letta episodic profiles." }
      ];
    }

    // Parse memories into text lines
    const timelineItems = memories.map(item => item.memory || item.content || item.text || JSON.stringify(item));

    // Extract core skills dynamically
    const allSkills = ['React', 'Node.js', 'Next.js', 'TypeScript', 'Docker', 'Supabase', 'Python', 'pgvector', 'Mem0', 'n8n', 'Express', 'Tailwind', 'Git'];
    const timelineText = timelineItems.join(' ');
    const detectedSkills = allSkills.filter(skill => new RegExp(`\\b${skill}\\b`, 'i').test(timelineText));
    if (detectedSkills.length === 0) detectedSkills.push('React', 'Node.js', 'TypeScript', 'Supabase', 'Git');

    // Build the gorgeous portfolio HTML template
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>💎 Portfolio — Autonomous AI Engineer Profile</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

    :root {
      --bg: #050508;
      --card-bg: #0c0c14;
      --border: #141424;
      --border-hover: #22223a;
      --primary: #7c3aed;
      --secondary: #06b6d4;
      --accent: #10b981;
      --text: #f8fafc;
      --muted: #64748b;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      padding: 60px 20px;
      line-height: 1.6;
    }

    /* Grid overlay */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: 
        linear-gradient(rgba(124, 58, 237, 0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124, 58, 237, 0.015) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
      z-index: 0;
    }

    .wrap {
      max-width: 850px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    /* Hero */
    header {
      padding: 40px 0 60px;
      position: relative;
      border-bottom: 1px solid var(--border);
      margin-bottom: 40px;
    }

    .hero-glow {
      position: absolute;
      top: -100px;
      left: 50%;
      transform: translateX(-50%);
      width: 500px;
      height: 250px;
      background: radial-gradient(ellipse, rgba(124, 58, 237, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .eyebrow {
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--secondary);
      margin-bottom: 12px;
    }

    h1 {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      letter-spacing: -2px;
      line-height: 1.1;
      background: linear-gradient(135deg, #fff 0%, #c084fc 50%, #22d3ee 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 16px;
    }

    .title {
      font-size: 18px;
      font-weight: 500;
      color: #e2e8f0;
      margin-bottom: 24px;
    }

    .badge-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .badge {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge.active {
      border-color: var(--primary);
      color: #c4b5fd;
      background: rgba(124, 58, 237, 0.08);
    }

    /* Sections */
    section {
      margin-bottom: 50px;
    }

    h2 {
      font-size: 14px;
      font-family: 'Space Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--secondary);
      margin-bottom: 24px;
      border-bottom: 1px dashed var(--border);
      padding-bottom: 8px;
    }

    /* Cards */
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    .card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }

    .card-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.6;
    }

    /* Interactive Terminal */
    .terminal-container {
      background: #040406;
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 45px rgba(0,0,0,0.6);
    }

    .terminal-header {
      background: #09090e;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }

    .terminal-dots {
      display: flex;
      gap: 6px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .dot.red { background: #ef4444; }
    .dot.yellow { background: #eab308; }
    .dot.green { background: #22c55e; }

    .terminal-title {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .terminal-body {
      padding: 20px;
      font-family: 'Space Mono', monospace;
      font-size: 12px;
      color: var(--accent);
      min-height: 220px;
      max-height: 350px;
      overflow-y: auto;
      line-height: 1.6;
    }

    .terminal-welcome {
      color: var(--muted);
      margin-bottom: 14px;
    }

    .terminal-output {
      margin-bottom: 10px;
      white-space: pre-wrap;
    }

    .terminal-prompt-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .terminal-prompt {
      color: var(--secondary);
    }

    .terminal-input {
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-family: 'Space Mono', monospace;
      font-size: 12px;
      flex-of: 1;
      flex: 1;
    }

    /* Print settings */
    @media print {
      body {
        background: #fff !important;
        color: #000 !important;
        padding: 0 !important;
      }
      body::before { display: none !important; }
      .hero-glow { display: none !important; }
      .terminal-container { display: none !important; }
      h2 { border-bottom: 2px solid #000 !important; color: #000 !important; }
      .card {
        background: #fff !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        color: #000 !important;
        page-break-inside: avoid;
      }
      .card-title { color: #000 !important; }
      .card-desc { color: #334155 !important; }
      .badge { border: 1.5px solid #000 !important; color: #000 !important; background: none !important; }
      h1 {
        background: none !important;
        -webkit-text-fill-color: #000 !important;
        color: #000 !important;
      }
    }
  </style>
</head>
<body>
<div class="wrap">

  <div class="hero-glow"></div>
  <header>
    <div class="eyebrow">Universal Portfolio</div>
    <h1>SHREY SHARMA</h1>
    <div class="title">Autonomous Systems & Full-Stack AI Engineer</div>
    <div class="badge-grid">
      ${detectedSkills.map(skill => `<span class="badge active">${skill}</span>`).join('\n      ')}
    </div>
  </header>

  <!-- TIMELINE -->
  <section>
    <h2>💼 Stateful Career Database (Retrieved from Mem0)</h2>
    <div class="timeline">
      ${timelineItems.map(item => `
      <div class="card">
        <div class="card-title">${item.split(':')[0] || 'Career Milestone'}</div>
        <div class="card-desc">${item.substring(item.indexOf(':') + 1).trim() || item}</div>
      </div>
      `).join('\n      ')}
    </div>
  </section>

  <!-- INTERACTIVE CLI TERMINAL -->
  <section>
    <h2>💻 Interactive Career Console</h2>
    <div class="terminal-container">
      <div class="terminal-header">
        <div class="terminal-dots">
          <div class="dot red"></div>
          <div class="dot yellow"></div>
          <div class="dot green"></div>
        </div>
        <span class="terminal-title">career-shell v2.0.0</span>
      </div>
      <div class="terminal-body" id="term-body">
        <div class="terminal-welcome">
          FLUX AI autonomous shell loaded.<br>
          Type <strong style="color: #fff">'help'</strong> to see available console actions.
        </div>
        <div id="term-log"></div>
        <div class="terminal-prompt-line">
          <span class="terminal-prompt">candidate@resumevault:~$</span>
          <input type="text" class="terminal-input" id="term-in" autofocus onkeydown="handleInput(event)">
        </div>
      </div>
    </div>
  </section>

</div>

<script>
  const logDiv = document.getElementById('term-log');
  const termBody = document.getElementById('term-body');
  const inputEl = document.getElementById('term-in');

  const skillsList = ${JSON.stringify(detectedSkills)};
  const factsList = ${JSON.stringify(timelineItems)};

  function handleInput(e) {
    if (e.key === 'Enter') {
      const val = inputEl.value.trim().toLowerCase();
      inputEl.value = '';

      // Log command
      const cmdLine = document.createElement('div');
      cmdLine.innerHTML = \`<span class="terminal-prompt">candidate@resumevault:~$</span> <span style="color: #fff">\${val}</span>\`;
      logDiv.appendChild(cmdLine);

      const respLine = document.createElement('div');
      respLine.className = 'terminal-output';

      switch (val) {
        case 'help':
          respLine.innerHTML = \`Available commands:
  <strong>skills</strong>   - Display core programming expertise
  <strong>timeline</strong> - Print episodic milestones from Mem0
  <strong>clear</strong>    - Clear the terminal console
  <strong>contact</strong>  - Display candidate coordinates\`;
          break;
        case 'skills':
          respLine.innerHTML = \`Parsed Tech Stack: \\n\${skillsList.map(s => '  - ' + s).join('\\n')}\`;
          break;
        case 'timeline':
          respLine.innerHTML = \`Autonomous Milestones: \\n\${factsList.map((f, i) => '  [' + (i+1) + '] ' + f).join('\\n')}\`;
          break;
        case 'contact':
          respLine.innerHTML = \`Candidate Coordinate Channels:
  Email:   shreyaskalasa18@gmail.com
  GitHub:  github.com/shrey
  Status:  Ready for Live Corporate Interviews\`;
          break;
        case 'clear':
          logDiv.innerHTML = '';
          respLine.innerHTML = '';
          break;
        default:
          respLine.innerHTML = \`Command not recognized: '\${val}'. Type 'help' for instructions.\`;
      }

      if (respLine.innerHTML) {
        logDiv.appendChild(respLine);
      }

      // Scroll to bottom
      termBody.scrollTop = termBody.scrollHeight;
    }
  }

  // Refocus terminal
  document.addEventListener('click', () => {
    inputEl.focus();
  });
</script>
</body>
</html>`;

    // Ensure the public directory exists inside orchestrator
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write file
    const destPath = path.join(publicDir, 'portfolio.html');
    fs.writeFileSync(destPath, htmlContent, 'utf8');

    console.log(`[PortfolioGen] Beautiful interactive portfolio compiled at: ${destPath}`);

    res.json({
      success: true,
      message: "Stunning interactive portfolio successfully generated!",
      filePath: destPath,
      skills: detectedSkills,
      milestonesCount: timelineItems.length
    });
  } catch (err) {
    console.error('[Server] Failed to generate portfolio:', err);
    res.status(500).json({ error: "Failed to generate portfolio file", message: err.message });
  }
});

// GET /api/analytics/funnel -> Expose resume A/B funnel and matching analytics
app.get('/api/analytics/funnel', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    funnel: {
      generated: 120,
      atsPassed: 98,
      submitted: 72,
      recruiterCallbacks: 24
    },
    conversionRates: {
      atsPassRate: 81.6,
      submissionRate: 60.0,
      callbackRate: 20.0
    },
    abTesting: [
      {
        style: "Backend Developer Profile",
        avgAtsScore: 95.8,
        resumesGenerated: 58,
        applicationsSubmitted: 35,
        callbacksReceived: 8,
        callbackRate: 22.8,
        color: "primary"
      },
      {
        style: "Full-Stack Engineer Profile",
        avgAtsScore: 91.2,
        resumesGenerated: 62,
        applicationsSubmitted: 37,
        callbacksReceived: 6,
        callbackRate: 16.2,
        color: "secondary"
      }
    ],
    keywordPolish: [
      { skill: "Docker", parsedDensity: 74, status: "warning", color: "yellow" },
      { skill: "Redis", parsedDensity: 68, status: "warning", color: "yellow" },
      { skill: "React", parsedDensity: 98, status: "optimal", color: "green" },
      { skill: "Node.js", parsedDensity: 92, status: "optimal", color: "green" }
    ]
  });
});

// GET /api/jobs/recommend -> Expose AI-powered job recommendations based on user skills
app.get('/api/jobs/recommend', async (req, res) => {
  const userId = req.query.userId || 'agent-zero-user';
  try {
    const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
    let userContext = '';
    try {
      const memRes = await fetch(`${MEMORY_API}/memory/retrieve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'skills, programming languages, technologies, experience', userId })
      });
      if (memRes.ok) {
        const memData = await memRes.json();
        const results = memData.results || memData.result || [];
        userContext = results.map(r => r.memory || r.text || r.content).join('. ');
      }
    } catch(e) {}
    
    const { generateResponse } = require('./router');
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    let realJobsContext = '';
    
    if (rapidApiKey && !rapidApiKey.includes('your_')) {
      const jsearchRes = await fetch('https://jsearch.p.rapidapi.com/search?query=Software%20Engineer&num_pages=1', {
        headers: { 'x-rapidapi-key': rapidApiKey, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' }
      });
      if (jsearchRes.ok) {
        const jd = await jsearchRes.json();
        const apiJobs = jd.data || [];
        realJobsContext = apiJobs.slice(0,5).map(j => `Title: ${j.job_title}, Company: ${j.employer_name}, URL: ${j.job_apply_link}, Desc: ${j.job_description?.substring(0,200)}`).join('\n\n');
      }
    }

    const prompt = `You are an expert AI Tech Recruiter.
The user has the following background and skills:
${userContext || 'React, Node.js, Next.js, Full Stack Development'}

Here are some REAL jobs scraped from the web right now:
${realJobsContext || '(No real jobs found, extract roles from the web)'}

Recommend 3 highly relevant REAL-WORLD job roles that perfectly match their profile. 
Use the real jobs provided above if they match, otherwise recommend extremely accurate specific roles.
Return ONLY a valid JSON array of objects with the following schema, and nothing else:
[
  {
    "title": "Job Title",
    "company": "Company Name",
    "url": "https://company.com/careers",
    "match": 95, 
    "status": "idle",
    "keywords": ["React", "Node.js"]
  }
]
No markdown formatting or extra text.`;

    const aiResponse = await generateResponse(prompt, '', 'deep', 'job-search');
    let jobs = [];
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jobs = JSON.parse(jsonMatch[0]);
      } else {
        jobs = [];
      }
    } catch (e) {
      console.warn("JSON Parse failed for job recommendations:", e);
      jobs = [];
    }
    
    res.json({ success: true, jobs });
  } catch (err) {
    console.error('[Jobs Recommend]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/skills/gap-analysis -> Compare candidate Mem0 skills vs. incoming job description
app.post('/api/skills/gap-analysis', async (req, res) => {
  const { jobDescription, userId = 'agent-zero-user' } = req.body;

  if (!jobDescription || jobDescription.trim().length < 20) {
    return res.status(400).json({ error: 'A job description of at least 20 characters is required.' });
  }

  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';

  // 1. Fetch candidate's skills from Mem0
  let candidateSkills = [];
  try {
    const memRes = await fetch(`${MEMORY_API}/memory/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'programming skills, technologies, languages, frameworks, tools, databases', userId })
    });
    if (memRes.ok) {
      const memData = await memRes.json();
      const results = memData.results || memData.result || [];
      results.forEach(item => {
        const text = item.memory || item.content || item.text || '';
        // Extract skill tokens from text
        const matches = text.match(/\b[A-Z][a-zA-Z0-9+#.]*\b/g) || [];
        candidateSkills.push(...matches);
      });
    }
  } catch (err) {
    console.warn('[GapAnalysis] Mem0 fetch failed, using defaults:', err.message);
  }

  // Default candidate skills if Mem0 is empty
  if (candidateSkills.length === 0) {
    candidateSkills = ['React', 'Node.js', 'Next.js', 'TypeScript', 'JavaScript', 'Supabase', 'PostgreSQL', 'Git', 'Docker', 'Python', 'Express', 'Tailwind', 'HTML', 'CSS', 'REST', 'GraphQL', 'Mem0', 'Redis'];
  }

  // Deduplicate
  candidateSkills = [...new Set(candidateSkills)].filter(s => s.length >= 2 && s.length <= 30);

  // 2. AI-Powered Skill Gap Analysis
  const prompt = `
You are an expert technical recruiter and AI career coach.
Analyze the Skill Gap between the following Candidate Skills and the Job Description.

Candidate Skills:
${candidateSkills.join(', ')}

Job Description:
${jobDescription}

Output a strict JSON object with EXACTLY this structure, no markdown formatting, no comments:
{
  "readinessScore": <number 0-100>,
  "totalRequiredSkills": <number>,
  "matched": [ {"skill": "skill_name"} ],
  "partial": [ {"skill": "skill_name", "note": "how to bridge it"} ],
  "missing": [ {"skill": "skill_name", "suggestion": "youtube or course link recommendation"} ],
  "summary": "<short 1-2 sentence summary of fit>"
}
`;

  try {
    const aiResponse = await generateResponse(prompt, 'You are a precise JSON-only API.', 'research', 'gap-analysis');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      candidateSkills: candidateSkills.slice(0, 20),
      ...parsed
    });
  } catch (error) {
    console.error('[GapAnalysis] AI Gap Analysis failed:', error);
    // Fallback if AI fails completely
    res.json({
      success: false,
      timestamp: new Date().toISOString(),
      readinessScore: 0,
      totalRequiredSkills: 0,
      matched: [],
      partial: [],
      missing: [{ skill: 'AI Analysis Failed', suggestion: 'Check backend logs.' }],
      candidateSkills: candidateSkills.slice(0, 20),
      summary: 'AI analysis failed.'
    });
  }
});

// ── Supabase RAG Documents Explorer Endpoints ──

// POST /api/rag/search -> Full-text keyword search on Supabase documents table
app.post('/api/rag/search', async (req, res) => {
  const { query = '', limit = 8 } = req.body;

  if (!supabase) {
    // Return demo docs if Supabase not configured
    const demoDocs = [
      { id: '1', content: 'FLUX AI career guideline: Always quantify achievements with metrics. Use action verbs like "designed", "implemented", "optimized". Keep resume to 1 page for < 5 years experience.', metadata: { source: 'resume_guidelines.pdf', type: 'guideline' }, created_at: new Date().toISOString() },
      { id: '2', content: 'ATS Optimization: Modern ATS systems parse PDFs using pdftotext. Avoid tables, images, and multi-column layouts. Use standard section headers: Experience, Education, Skills, Projects.', metadata: { source: 'ats_best_practices.pdf', type: 'guideline' }, created_at: new Date().toISOString() },
      { id: '3', content: 'Software Engineer Intern - Figma: Requirements: React, TypeScript, Node.js, GraphQL, REST APIs, unit testing. Nice to have: Design systems, Figma Plugin API, Postgres.', metadata: { source: 'figma_jd.txt', type: 'job_description' }, created_at: new Date().toISOString() },
      { id: '4', content: 'Backend Engineer - Vercel: Required: Node.js, Go or Rust, PostgreSQL, Docker, Kubernetes, CI/CD pipelines. AWS or GCP experience preferred. Distributed systems experience a plus.', metadata: { source: 'vercel_jd.txt', type: 'job_description' }, created_at: new Date().toISOString() },
      { id: '5', content: 'Cover Letter Template: Opening paragraph should express genuine excitement for the company mission. Middle paragraph connects your 2-3 strongest achievements directly to job requirements. Closing: Call to action.', metadata: { source: 'cover_letter_template.md', type: 'template' }, created_at: new Date().toISOString() },
      { id: '6', content: 'Interview Preparation Guide: STAR method — Situation, Task, Action, Result. Prepare 5 behavioral stories. Study company tech stack. Research recent engineering blog posts. Prepare 3 thoughtful questions.', metadata: { source: 'interview_prep.pdf', type: 'guideline' }, created_at: new Date().toISOString() },
    ];

    const filtered = query.trim()
      ? demoDocs.filter(d => d.content.toLowerCase().includes(query.toLowerCase()) || (d.metadata?.source || '').toLowerCase().includes(query.toLowerCase()))
      : demoDocs;

    return res.json({ success: true, results: filtered.slice(0, limit), count: filtered.length, source: 'demo' });
  }

  try {
    let dbQuery = supabase
      .from('documents')
      .select('id, content, metadata, created_at')
      .limit(limit)
      .order('created_at', { ascending: false });

    if (query.trim()) {
      // Use Postgres full-text search via textSearch
      dbQuery = supabase
        .from('documents')
        .select('id, content, metadata, created_at')
        .textSearch('content', query.trim(), { type: 'websearch', config: 'english' })
        .limit(limit);
    }

    const { data, error } = await dbQuery;

    if (error) {
      // Fallback: ilike search if full-text fails
      const { data: fallback, error: fallbackError } = await supabase
        .from('documents')
        .select('id, content, metadata, created_at')
        .ilike('content', `%${query}%`)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (fallbackError) throw fallbackError;
      return res.json({ success: true, results: fallback || [], count: fallback?.length || 0, source: 'supabase-ilike' });
    }

    res.json({ success: true, results: data || [], count: data?.length || 0, source: 'supabase-fts' });
  } catch (err) {
    console.error('[RAG Explorer] Search failed:', err.message);
    res.status(500).json({ error: 'RAG search failed', message: err.message });
  }
});

// POST /api/rag/seed -> Insert demo documents into Supabase for demo
app.post('/api/rag/seed', async (req, res) => {
  if (!supabase) return res.json({ success: false, message: 'Supabase not configured' });

  const seedDocs = [
    { content: 'FLUX AI career guideline: Always quantify achievements with metrics. Use action verbs like "designed", "implemented", "optimized". Keep resume to 1 page for < 5 years experience.', metadata: { source: 'resume_guidelines.pdf', type: 'guideline' } },
    { content: 'ATS Optimization: Modern ATS systems parse PDFs using pdftotext. Avoid tables, images, and multi-column layouts. Use standard section headers: Experience, Education, Skills, Projects.', metadata: { source: 'ats_best_practices.pdf', type: 'guideline' } },
    { content: 'Software Engineer Intern - Figma: Requirements: React, TypeScript, Node.js, GraphQL, REST APIs. Nice to have: Design systems, Figma Plugin API, Postgres.', metadata: { source: 'figma_jd.txt', type: 'job_description' } },
    { content: 'Backend Engineer - Vercel: Required: Node.js, PostgreSQL, Docker, Kubernetes, CI/CD. AWS or GCP experience preferred.', metadata: { source: 'vercel_jd.txt', type: 'job_description' } },
    { content: 'Cover Letter Template: Opening expresses excitement for company mission. Middle paragraph connects 2-3 strongest achievements to job requirements. Closing: Call to action.', metadata: { source: 'cover_letter_template.md', type: 'template' } },
    { content: 'Interview Preparation: STAR method — Situation, Task, Action, Result. Prepare 5 behavioral stories. Research company engineering blog. Prepare 3 thoughtful questions.', metadata: { source: 'interview_prep.pdf', type: 'guideline' } },
  ];

  const { error } = await supabase.from('documents').insert(seedDocs);
  if (error) return res.status(500).json({ success: false, error: error.message });
  res.json({ success: true, message: `Seeded ${seedDocs.length} documents into Supabase.` });
});

// POST /api/demo/import-profile -> Deep-scrape GitHub, CLEAR old memories, use AI to organize, store fresh profile
app.post('/api/demo/import-profile', async (req, res) => {
  const { githubUsername, linkedinUsername } = req.body;
  if (!githubUsername) return res.status(400).json({ error: 'Missing githubUsername' });
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
  const userId = `user-${githubUsername}`;
  
  // Try to load Web Scraper for LinkedIn scrape
  let scrapeWeb = null;
  try {
    const scraper = require('../tools/web-scraper.js');
    scrapeWeb = scraper.scrapeWeb;
  } catch(e) { console.warn('Web Scraper tool not found'); }

  try {
    // ── STEP 1: Deep GitHub scrape (user + repos + READMEs + events) ──
    const ghHeaders = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'FLUX-AI', ...(process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
    
    const [userRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${githubUsername}`, { headers: ghHeaders }),
      fetch(`https://api.github.com/users/${githubUsername}/repos?sort=pushed&per_page=30&type=owner`, { headers: ghHeaders }),
      fetch(`https://api.github.com/users/${githubUsername}/events/public?per_page=30`, { headers: ghHeaders })
    ]);

    let user = {};
    let repos = [];
    let events = [];

    if (userRes.ok) {
      user = await userRes.json();
      repos = reposRes.ok ? await reposRes.json() : [];
      events = eventsRes.ok ? await eventsRes.json() : [];
    } else {
      console.warn(`[Import] GitHub API fetch failed for '${githubUsername}' (Status: ${userRes.status}). Falling back to direct web scraping...`);
      try {
        const scraper = require('../tools/web-scraper.js');
        const scrapeRes = await scraper.scrapeWeb(`https://github.com/${githubUsername}`);
        if (scrapeRes && scrapeRes.content) {
          user = {
            name: githubUsername,
            bio: `[SCRAPED GITHUB DATA OVERRIDE]: ${scrapeRes.content.substring(0, 4000)}`
          };
          console.log(`[Import] Successfully scraped real GitHub data directly!`);
        }
      } catch (e) {
        console.warn(`[Import] Direct scrape also failed:`, e.message);
      }
    }

    // Basic user info
    const name = user.name || linkedinUsername || githubUsername;
    const bio = user.bio || '';
    const company = (user.company || '').replace('@', '');
    const location = user.location || '';
    const email = user.email || `${githubUsername}@github.com`;
    const githubUrl = `github.com/${githubUsername}`;
    const followers = user.followers || 0;
    const publicRepos = user.public_repos || 0;
    const createdAt = user.created_at ? new Date(user.created_at).getFullYear() : '';

    // ── STEP 2: Parse repos deeply ──
    const nonForkRepos = repos.filter(r => !r.fork);
    const allLanguages = new Set();
    const allTopics = new Set();
    const repoDetails = [];

    for (const repo of nonForkRepos) {
      if (repo.language) allLanguages.add(repo.language);
      (repo.topics || []).forEach(t => allTopics.add(t));
      repoDetails.push({
        name: repo.name,
        description: repo.description || '',
        language: repo.language || 'Unknown',
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        topics: (repo.topics || []).join(', '),
        updatedAt: repo.pushed_at,
        homepage: repo.homepage || '',
        size: repo.size
      });
    }

    // ── STEP 3: Fetch README for top repos (by stars then recency) ──
    const topRepos = [...nonForkRepos]
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
      .slice(0, 15);

    const readmeContents = {};
    await Promise.all(topRepos.map(async (repo) => {
      try {
        const readmeRes = await fetch(`https://api.github.com/repos/${githubUsername}/${repo.name}/readme`, { headers: ghHeaders });
        if (readmeRes.ok) {
          const readmeData = await readmeRes.json();
          // Decode base64 README content
          const content = Buffer.from(readmeData.content || '', 'base64').toString('utf8');
          // Truncate to 1500 chars to stay within LLM context limits
          readmeContents[repo.name] = content.substring(0, 1500);
        }
      } catch { /* skip */ }
    }));

    // ── STEP 4: Parse recent activity ──
    const recentActivity = [];
    const pushEvents = events.filter(e => e.type === 'PushEvent').slice(0, 30);
    const prEvents = events.filter(e => e.type === 'PullRequestEvent').slice(0, 15);
    const issueEvents = events.filter(e => e.type === 'IssuesEvent').slice(0, 15);
    
    pushEvents.forEach(e => {
      const commits = e.payload?.commits || [];
      commits.forEach(c => {
        if (c.message && !c.message.startsWith('Merge')) {
          recentActivity.push(`Commit in ${e.repo?.name?.split('/')[1] || 'repo'}: ${c.message.substring(0, 100)}`);
        }
      });
    });
    prEvents.forEach(e => {
      recentActivity.push(`PR ${e.payload?.action}: "${e.payload?.pull_request?.title}" in ${e.repo?.name?.split('/')[1] || 'repo'}`);
    });

    // ── STEP 4.5: Fetch LIVE LinkedIn Data via RapidAPI (Fresh LinkedIn Profile Data API) ──
    let linkedinData = null;
    if (linkedinUsername) {
      console.log(`[Import] Fetching LIVE LinkedIn data for "${linkedinUsername}" using RapidAPI Fresh LinkedIn Profile Data API...`);
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      const API_HOST = 'fresh-linkedin-profile-data-api.p.rapidapi.com';
      const headers = {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': API_HOST,
        'Content-Type': 'application/json'
      };
      
      try {
        // Strategy 1: Use "Search LinkedIn" endpoint with the username/URL as query
        const searchQuery = linkedinUsername.includes('linkedin.com') ? linkedinUsername : linkedinUsername;
        const searchUrl = `https://${API_HOST}/api/search/people?query=${encodeURIComponent(searchQuery)}&count=1`;
        console.log(`[Import] LinkedIn API call: ${searchUrl}`);
        
        const liRes = await fetch(searchUrl, { method: 'GET', headers });

        if (liRes.ok) {
          const liJson = await liRes.json();
          console.log('[Import] LinkedIn API raw response keys:', Object.keys(liJson));
          
          // The API may return data in different shapes; handle all
          const profiles = liJson.data || liJson.results || liJson.people || (Array.isArray(liJson) ? liJson : [liJson]);
          const profile = Array.isArray(profiles) ? profiles[0] : profiles;
          
          if (profile) {
            // Extract all available fields robustly
            const fullName = profile.full_name || profile.name || profile.first_name && `${profile.first_name} ${profile.last_name || ''}` || '';
            const headline = profile.headline || profile.title || '';
            const summary = profile.summary || profile.about || profile.description || '';
            const locationStr = profile.location || profile.city || '';
            
            // Education
            const educations = profile.educations || profile.education || [];
            const eduText = (Array.isArray(educations) ? educations : []).map(e => {
              const degree = e.degree || e.degree_name || e.field_of_study || '';
              const school = e.school_name || e.school || e.institution_name || '';
              const start = e.date_start || e.start_date || e.starts_at?.year || '';
              const end = e.date_end || e.end_date || e.ends_at?.year || 'Present';
              return `${degree} at ${school} (${start}-${end})`;
            }).join('; ');
            
            // Experience
            const experiences = profile.experiences || profile.experience || profile.positions || [];
            const expText = (Array.isArray(experiences) ? experiences : []).map(e => {
              const title = e.title || e.position || e.role || '';
              const company = e.company_name || e.company || e.organization || '';
              const start = e.date_start || e.start_date || e.starts_at?.year || '';
              const end = e.date_end || e.end_date || e.ends_at?.year || 'Present';
              const desc = e.description || '';
              return `${title} at ${company} (${start}-${end})${desc ? ' - ' + desc : ''}`;
            }).join('; ');
            
            // Skills
            const skills = profile.skills || [];
            const skillsText = (Array.isArray(skills) ? skills : []).map(s => typeof s === 'string' ? s : (s.name || s.skill || '')).join(', ');
            
            // Certifications
            const certs = profile.certifications || [];
            const certsText = (Array.isArray(certs) ? certs : []).map(c => c.name || c.title || '').join(', ');
            
            linkedinData = {
              source: "RapidAPI Fresh LinkedIn Profile Data API (Live Scrape)",
              answer: [
                fullName ? `Full Name: ${fullName}` : '',
                headline ? `Headline: ${headline}` : '',
                summary ? `Summary: ${summary}` : '',
                locationStr ? `Location: ${locationStr}` : '',
                expText ? `Experience: ${expText}` : '',
                eduText ? `Education: ${eduText}` : '',
                skillsText ? `Skills: ${skillsText}` : '',
                certsText ? `Certifications: ${certsText}` : '',
              ].filter(Boolean).join('\n')
            };
            console.log(`[Import] ✅ Successfully scraped LinkedIn profile for "${fullName}" via RapidAPI!`);
            console.log(`[Import] LinkedIn data preview: ${linkedinData.answer.substring(0, 300)}...`);
          } else {
            console.warn('[Import] LinkedIn API returned empty profile data');
          }
        } else {
          const errBody = await liRes.text();
          console.warn(`[Import] LinkedIn API returned status ${liRes.status}: ${errBody.substring(0, 200)}`);
        }
      } catch (err) {
        console.warn('[Import] RapidAPI LinkedIn scrape threw error:', err.message);
      }
    }

    // ── STEP 5: Send ALL data to Groq LLM to organize into career memories ──
    const rawDataPayload = {
      name, bio, company, location, email, githubUrl,
      linkedin: linkedinData,
      followers, publicRepos, memberSince: createdAt,
      languages: Array.from(allLanguages),
      topics: Array.from(allTopics),
      repos: repoDetails,
      readmes: readmeContents,
      recentActivity: recentActivity.slice(0, 50)
    };

    let aiOrganizedMemories = [];
    try {
      const orgPrompt = `You are an expert AI Memory Organizer.
Your task is to take this raw, unstructured GitHub data and extract all meaningful career information into atomic "Memory Tokens".

FORMAT REQUIREMENTS:
Each memory MUST be a single, standalone string starting with a category tag.
Categories: [PROFILE, SUMMARY, PROJECT, SKILL, EXPERIENCE, EDUCATION, ACHIEVEMENT]

CRITICAL EXTRACTION RULES:
- DO NOT SUMMARIZE. You must create a separate PROJECT memory for EVERY single repository provided in the data.
- Extract EVERY SINGLE detail from A to Z. Leave absolutely nothing behind.
- If a README describes features, tech stack, or architecture, incorporate that into the project description.
- Group related skills (e.g. "SKILL: Cloud & DevOps — AWS, Docker, Kubernetes, CI/CD")
- Prioritize LinkedIn data for EXPERIENCE and EDUCATION if it exists
- Be extremely thorough — extract 30-50 memories minimum. Do not miss any repository.
- Return ONLY a valid JSON array of strings, nothing else

Raw GitHub Data:
${JSON.stringify(rawDataPayload, null, 1)}`;

      const { generateResponse } = require('./router');
      const raw = await generateResponse(orgPrompt, '', 'deep', 'import-profile');
      
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          aiOrganizedMemories = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.warn('[Import] Strict JSON parse failed, using eval fallback');
          aiOrganizedMemories = new Function("return " + jsonMatch[0])();
        }
        if (!Array.isArray(aiOrganizedMemories)) aiOrganizedMemories = [];
        console.log(`[Import] AI organized ${aiOrganizedMemories.length} memories for ${githubUsername}`);
      }
    } catch (err) {
      console.error('[Import] AI organization failed, falling back to basic:', err.message);
    }

    // ── STEP 6: Fallback if AI fails ──
    if (aiOrganizedMemories.length === 0) {
      // Basic fallback
      if (bio) aiOrganizedMemories.push(`SUMMARY: ${name} — ${bio}`);
      if (allLanguages.size > 0) aiOrganizedMemories.push(`SKILL: Programming Languages — ${Array.from(allLanguages).join(', ')}`);
      if (allTopics.size > 0) aiOrganizedMemories.push(`SKILL: Topics & Frameworks — ${Array.from(allTopics).join(', ')}`);
      nonForkRepos.forEach(repo => {
        aiOrganizedMemories.push(`PROJECT: ${repo.name} — ${repo.description || 'Open source project'}${repo.language ? ' (' + repo.language + ')' : ''}${repo.stargazers_count > 0 ? ' ⭐' + repo.stargazers_count : ''}`);
      });
      if (followers > 0) aiOrganizedMemories.push(`ACHIEVEMENT: ${followers} GitHub followers, ${publicRepos} public repositories`);
      if (linkedinData && linkedinData.answer) {
        aiOrganizedMemories.push(`EXPERIENCE: LinkedIn Summary — ${linkedinData.answer.substring(0, 500)}`);
      }
    }

    // Build profile memory (special prefix so resume can extract it)
    const profileMem = `PROFILE: name=${name} | email=${email} | github=${githubUrl} | location=${location}${bio ? ' | bio=' + bio : ''}${company ? ' | company=' + company : ''}`;

    // Build milestone cards for the frontend
    const importedMilestones = [];
    importedMilestones.push({ id: 'profile', title: name.substring(0, 20), category: 'Profile', desc: `${name}${bio ? ' — ' + bio : ''}${location ? ' from ' + location : ''}` });

    const categoryMap = { 'SKILL': 'Language', 'PROJECT': 'Project', 'ACHIEVEMENT': 'Achievement', 'EXPERIENCE': 'Experience', 'EDUCATION': 'Education', 'CERTIFICATION': 'Certification', 'SUMMARY': 'Profile' };
    aiOrganizedMemories.forEach((mem, idx) => {
      const prefix = (mem.match(/^(\w+):/)?.[1] || 'OTHER').toUpperCase();
      const category = categoryMap[prefix] || 'Other';
      const content = mem.replace(/^\w+:\s*/, '');
      importedMilestones.push({
        id: `ai-${idx}`,
        title: content.substring(0, 25),
        category,
        desc: mem
      });
    });

    // ── STEP 7: CLEAR old memories FIRST (synchronous, not background) ──
    try {
      const { MemoryClient } = require('mem0ai');
      const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
      // Try filters syntax first (newer SDK), fallback to top-level
      let mems = [];
      try {
        const allMems = await mem0.getAll({ filters: { user_id: userId } });
        mems = allMems.results || allMems || [];
      } catch {
        try {
          const allMems = await mem0.getAll({ user_id: userId });
          mems = allMems.results || allMems || [];
        } catch { mems = []; }
      }
      if (mems.length > 0) {
        await Promise.all(mems.map(m => mem0.delete(m.id).catch(() => {})));
        console.log(`[Import] Cleared ${mems.length} old memories for ${userId}`);
      }
    } catch (e) {
      console.warn('[Import] Could not clear old memories:', e.message);
    }

    // Respond to frontend with the AI-organized data
    res.json({ success: true, message: `AI organized ${importedMilestones.length} career facts from ${nonForkRepos.length} repos`, milestones: importedMilestones, username: githubUsername, name });

    // ── STEP 8: Store fresh AI-organized memories in Mem0 (background) ──
    const allMemoryStrings = [profileMem, ...aiOrganizedMemories];
    (async () => {
      await Promise.all(allMemoryStrings.map(text =>
        fetch(`${MEMORY_API}/memory/store`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, userId })
        }).catch(e => console.warn('[BG Mem0 Store]', e.message))
      ));
      console.log(`[Import] Stored ${allMemoryStrings.length} AI-organized memories for ${githubUsername}`);
    })();

  } catch (error) {
    console.error('Import Profile Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── A5: Resume PDF Export ──

// POST /api/resume/export -> AI writes the ENTIRE resume from Mem0 data
app.post('/api/resume/export', async (req, res) => {
  const { userId = 'agent-zero-user', company = 'Target Company', jobTitle = 'Software Engineer', jobDescription = '', customInstructions = '', candidateName = '' } = req.body;
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
  
  // userId now comes pre-scoped from the frontend (e.g. 'user-pranalibose')
  const activeUserId = userId;

  // 1. Fetch memories from Mem0 — use BOTH search and getAll to ensure profile data isn't missed
  let memories = [];
  try {
    // First: semantic search for career data
    const memRes = await fetch(`${MEMORY_API}/memory/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'skills, projects, certifications, experiences, achievements, education, profile, summary, name, email, bio', userId: activeUserId })
    });
    if (memRes.ok) {
      const memData = await memRes.json();
      memories = memData.results || memData.result || [];
    }
  } catch (err) {
    console.warn('[ResumeExport] Mem0 search unavailable');
  }

  // Second: getAll to ensure we have the profile entry (Mem0 search often misses it)
  try {
    const { MemoryClient } = require('mem0ai');
    const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
    let allMems = [];
    try { const r = await mem0.getAll({ filters: { user_id: activeUserId } }); allMems = r.results || r || []; }
    catch { try { const r = await mem0.getAll({ user_id: activeUserId }); allMems = r.results || r || []; } catch { } }
    
    // Merge: add any memories from getAll that aren't already in the search results
    const existingIds = new Set(memories.map(m => m.id));
    for (const m of allMems) {
      if (!existingIds.has(m.id)) {
        memories.push(m);
      }
    }
    console.log(`[ResumeExport] Merged: ${memories.length} total memories (search + getAll)`);
  } catch (err) {
    console.warn('[ResumeExport] getAll fallback failed:', err.message);
  }

  const timelineItems = memories.map(item => item.memory || item.content || item.text || '').filter(Boolean);

  // DEBUG: Log memory items to see what Mem0 actually returns
  console.log(`[ResumeExport] Retrieved ${timelineItems.length} memory items. First 3:`);
  timelineItems.slice(0, 3).forEach((t, i) => console.log(`  [${i}] ${t.substring(0, 200)}`));
  const allMemText = timelineItems.join('\n');
  
  // Try to extract name from memory text using common patterns
  let profileName = candidateName || 'Candidate';
  let profileEmail = '';
  let profileGithub = '';
  let profileLocation = '';
  let profileBio = '';
  let profileCompany = '';

  // Check for PROFILE: prefix format first (original format)
  const profileMem = timelineItems.find(t => t.startsWith('PROFILE:')) || '';
  if (profileMem) {
    const extractField = (field) => { const m = profileMem.match(new RegExp(field + '=([^|]+)')); return m ? m[1].trim() : ''; };
    profileName = extractField('name') || 'Candidate';
    profileEmail = extractField('email') || '';
    profileGithub = extractField('github') || '';
    profileLocation = extractField('location') || '';
    profileBio = extractField('bio') || '';
    profileCompany = extractField('company') || '';
  }

  // Fallback: extract from natural language memories (Mem0 often rewrites the prefix away)
  if (profileName === 'Candidate') {
    // Try common patterns Mem0 uses when it rewrites PROFILE: entries
    for (const item of timelineItems) {
      const nameMatch = item.match(/(?:PROFILE|profile)\s+added\s+a\s+profile\s+entry\s+for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
        || item.match(/profile\s+(?:entry\s+)?for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
        || item.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)[''\u2019]s\s+profile/i)
        || item.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+is\s+an?\s+experienced/i)
        || item.match(/name\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      if (nameMatch) { profileName = nameMatch[1].trim(); break; }
    }
  }
  if (!profileEmail) {
    for (const item of timelineItems) {
      const emailMatch = item.match(/email\s+([^\s,]+@[^\s,]+)/i) || item.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) { profileEmail = emailMatch[1].trim(); break; }
    }
  }
  if (!profileGithub) {
    for (const item of timelineItems) {
      const ghMatch = item.match(/github\.com\/([a-zA-Z0-9_-]+)/i) || item.match(/GitHub\s+(?:URL\s+)?(?:is\s+)?github\.com\/([a-zA-Z0-9_-]+)/i);
      if (ghMatch) { profileGithub = `github.com/${ghMatch[1]}`; break; }
    }
  }
  if (!profileLocation) {
    for (const item of timelineItems) {
      const locMatch = item.match(/location\s+(?:is\s+)?([A-Z][a-zA-Z\s,]+?)(?:\.|,|$)/i);
      if (locMatch) { profileLocation = locMatch[1].trim(); break; }
    }
  }
  if (!profileBio) {
    for (const item of timelineItems) {
      const bioMatch = item.match(/(?:bio|describes?\s+(?:her|him|them)\s+as)\s+(?:stating\s+)?(?:she|he|they\s+(?:is|are)\s+)?(?:an?\s+)?(.+?)(?:\.|$)/i);
      if (bioMatch) { profileBio = bioMatch[1].trim(); break; }
    }
  }

  console.log(`[ResumeExport] Extracted profile: name="${profileName}", email="${profileEmail}", github="${profileGithub}", location="${profileLocation}"`);

  const contentItems = timelineItems;

  // 3. Ask AI to write the ENTIRE resume as a complete HTML document
  let fullResumeHtml = '';
  let generatedJsonData = null;
  try {
    const profileData = {
      name: profileName,
      email: profileEmail,
      github: profileGithub,
      location: profileLocation,
      bio: profileBio,
      company: profileCompany,
      careerData: contentItems
    };
    
    console.log(`[ResumeExport] Generating resume via report-generator...`);
    const genResult = await generateResume({ 
      profileData, 
      targetJob: `${jobTitle} at ${company}\n\nJob Description:\n${jobDescription}`,
      customInstructions
    });

    if (genResult.success) {
      fullResumeHtml = genResult.html;
      generatedJsonData = genResult.jsonData;
      console.log(`[ResumeExport] AI generated full resume for ${profileName} (${fullResumeHtml.length} chars)`);
    } else {
      throw new Error(genResult.error);
    }
  } catch (err) {
    console.error('[ResumeExport] AI resume generation failed:', err.message);
    
    // Fallback: provide a safe JSON so the frontend template can render SOMETHING instead of a blank page
    generatedJsonData = {
      name: profileName || "Your Name",
      contactInfo: `${profileEmail || 'email@example.com'} | ${profileGithub || 'github.com/user'}`,
      tagline: "Software Engineer",
      locationPref: profileLocation || "Remote",
      overviewBullets: ["A passionate software engineer building impactful applications."],
      technicalSkills: [
        { category: "Core", skills: "JavaScript, React, Node.js, Next.js" }
      ],
      functionalSkills: ["Agile, Team Leadership"],
      mainProjectTitle: "AI Application",
      otherProjects: ["Personal Portfolio"],
      significantHighlights: [
        { company: company || "Target Company", bullets: ["Prepared data and successfully passed initial ATS scanning.", "Ready to contribute immediately."] }
      ],
      academicCredentials: "B.S. in Computer Science"
    };

    // Fallback: basic HTML resume
    fullResumeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume — ${profileName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #000; background: #fff; padding: 40px 50px; line-height: 1.5; font-size: 11pt; max-width: 850px; margin: 0 auto; }
    header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 22pt; text-transform: uppercase; }
    .contact { font-size: 10pt; margin-top: 4px; }
    h2 { font-size: 12pt; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin: 14px 0 8px; }
    ul { padding-left: 20px; margin: 4px 0 12px; }
    li { margin-bottom: 3px; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#0f172a;color:#fff;padding:10px 20px;margin:-40px -50px 20px;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
    <span>📄 Resume for ${company}</span>
    <button onclick="window.print()" style="background:#fff;color:#000;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:bold;">Print / Save PDF</button>
  </div>
  <header>
    <h1>${profileName}</h1>
    <div class="contact">${[profileEmail, profileGithub, profileLocation].filter(Boolean).join(' • ')}</div>
  </header>
  ${profileBio ? `<p style="margin-bottom:14px;"><strong>${profileBio}</strong></p>` : ''}
  <h2>Career Profile</h2>
  <ul>
    ${contentItems.map(item => `<li>${item.replace(/^\w+:\s*/, '')}</li>`).join('\n    ')}
  </ul>
</body>
</html>`;
  }

  // 4. ATS Scoring (runs on the final HTML text)
  let finalHtml = fullResumeHtml;
  let atsScore = 85; // Solid baseline
  let atsData = {
    score: 85,
    matched_count: 5,
    missing_count: 0,
    top_missing_keywords: ["Supply a JD for full ATS match"],
    status: 'PASS'
  };

  if (jobDescription && jobDescription.trim().length > 10) {
    try {
      const plainText = finalHtml.replace(/<[^>]+>/g, ' ').toLowerCase();
      const jdText = jobDescription.toLowerCase();

      const stopwords = new Set(['and','the','is','in','to','with','for','of','a','an','on','at','by','this','that','are','as','be','or','it','we','you','our','your','will','can','has','have','been','would','should','could','may','also','from','but','not','all','they','their','was','were','had','who','which','what','where','when','how','than','each','other','into','more','some','such','only','over','about','up','out','if','do','no','so','very','just','any','these','new','most','well']);
      const tokenize = (text) => text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));

      const resumeTokens = new Set(tokenize(plainText));
      const jdKeywords = [...new Set(tokenize(jdText))].slice(0, 50); // Get top 50 keywords

      const matched = jdKeywords.filter(kw => resumeTokens.has(kw));
      const missing = jdKeywords.filter(kw => !resumeTokens.has(kw));

      // Calculate a generous but realistic ATS score
      const baseScore = 60; 
      let keywordScore = 0;
      if (jdKeywords.length > 0) {
        keywordScore = (matched.length / jdKeywords.length) * 40;
      } else {
        // If there's no real keywords in the JD, default to a safe 85
        keywordScore = 25;
      }
      const score = Math.round(baseScore + keywordScore);

      atsData = {
        score,
        matched_count: matched.length,
        missing_count: missing.length,
        top_missing_keywords: missing.slice(0, 10),
        status: score >= 75 ? 'PASS' : 'FAIL'
      };
      atsScore = score;
    } catch (err) {
      console.error('[ATS Parser] Error:', err);
    }
  }

  const responsePayload = { html: finalHtml };
  if (generatedJsonData) {
    responsePayload.jsonData = generatedJsonData;
  }
  if (atsData) {
    responsePayload.atsScore = Math.round(atsScore);
    responsePayload.atsData = atsData;
  }

  res.json(responsePayload);
});

// ── A5: Export Full AI Resume via Mem0 Data ──

// POST /api/resume/edit -> Update resume JSON state using LLM
app.post('/api/resume/edit', async (req, res) => {
  const { instructions, currentData } = req.body;
  if (!instructions || !currentData) return res.status(400).json({ error: 'Missing instructions or currentData' });
  
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const prompt = `You are a world-class Executive Resume Writer.
The user wants to make a specific edit to their resume.

CURRENT RESUME JSON DATA:
${JSON.stringify(currentData, null, 2)}

USER INSTRUCTIONS:
"${instructions}"

Task: Apply the user's instructions to the CURRENT RESUME JSON DATA.
Only modify the fields the user asked to change. Keep the rest exactly the same.
Return ONLY the updated valid JSON object. Do not wrap in markdown or add explanations.

The schema MUST exactly match the keys of the CURRENT RESUME JSON DATA.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    let contentStr = chatCompletion.choices[0]?.message?.content || '{}';
    if (contentStr.startsWith('\`\`\`json')) {
      contentStr = contentStr.replace(/^\`\`\`json/i, '').replace(/\`\`\`$/, '').trim();
    }
    const updatedData = JSON.parse(contentStr);
    
    res.json({ success: true, updatedData });
  } catch (err) {
    console.error('[ResumeEdit] Failed:', err);
    res.status(500).json({ error: 'Failed to apply edits', message: err.message });
  }
});


// In-memory Kanban store (falls back gracefully without Supabase)
let applicationBoard = [
  { id: '1', company: 'Figma', role: 'Software Engineer Intern', status: 'applied', atsScore: 95, appliedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), url: 'https://boards.greenhouse.io/figma' },
  { id: '2', company: 'Vercel', role: 'Backend Engineer Intern', status: 'recruiter_viewed', atsScore: 90, appliedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), url: 'https://jobs.lever.co/vercel' },
  { id: '3', company: 'Supabase', role: 'Full-Stack Developer', status: 'interview_scheduled', atsScore: 88, appliedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), url: 'https://boards.greenhouse.io/supabase' },
];

// GET /api/applications -> Return current Kanban board state
app.get('/api/applications', async (req, res) => {
  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('agent_outputs')
        .select('id, output, timestamp')
        .eq('agent_name', 'application_tracker')
        .order('timestamp', { ascending: false })
        .limit(20);
      if (!error && data && data.length > 0) {
        const cards = data.map(row => row.output);
        return res.json({ success: true, applications: cards, source: 'supabase' });
      }
    } catch (err) {
      console.warn('[AppTracker] Supabase query failed, using in-memory board');
    }
  }
  res.json({ success: true, applications: applicationBoard, source: 'memory' });
});

// PATCH /api/applications/:id -> Update status of a card
app.patch('/api/applications/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['applied', 'recruiter_viewed', 'interview_scheduled', 'offer', 'rejected'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const idx = applicationBoard.findIndex(a => a.id === id);
  if (idx !== -1) applicationBoard[idx].status = status;

  if (supabase) {
    try {
      await supabase.from('agent_outputs').upsert({
        id,
        agent_name: 'application_tracker',
        input: { id },
        output: applicationBoard[idx] || { id, status },
        confidence: 1.0,
        timestamp: new Date().toISOString()
      });
    } catch (err) { /* ignore */ }
  }

  res.json({ success: true, updated: applicationBoard[idx] });
});

// POST /api/applications -> Add a new application card
app.post('/api/applications', async (req, res) => {
  const { company, role, atsScore = 0, url = '', status = 'applied' } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'company and role are required' });

  const newCard = {
    id: Date.now().toString(),
    company, role, status, atsScore, url,
    appliedAt: new Date().toISOString()
  };
  applicationBoard.unshift(newCard);

  if (supabase) {
    try {
      await supabase.from('agent_outputs').insert({
        agent_name: 'application_tracker',
        input: { company, role },
        output: newCard,
        confidence: 1.0
      });
    } catch (err) { /* ignore */ }
  }

  res.json({ success: true, application: newCard });
});

// ── A7: Resume Version History ──

// In-memory version store
let resumeVersions = [
  { id: 'v1', version: 1, company: 'Figma', atsScore: 92.5, timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), summary: 'Tailored for UI/Frontend role. Emphasized React and Design Systems.' },
  { id: 'v2', version: 2, company: 'Vercel', atsScore: 95.8, timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), summary: 'Backend-focused version. Emphasized Node.js, Postgres, Docker, and distributed systems.' },
];

// GET /api/resume/versions -> List all saved resume versions
app.get('/api/resume/versions', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, content, metadata, created_at')
        .eq('metadata->>type', 'resume_version')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data && data.length > 0) {
        const versions = data.map(d => ({
          id: d.id,
          version: d.metadata?.version || 1,
          company: d.metadata?.company || 'Unknown',
          atsScore: d.metadata?.atsScore || 0,
          timestamp: d.created_at,
          summary: d.content.substring(0, 120) + '...'
        }));
        return res.json({ success: true, versions, source: 'supabase' });
      }
    } catch (err) {
      console.warn('[ResumeVersions] Supabase query failed, using in-memory');
    }
  }
  res.json({ success: true, versions: resumeVersions, source: 'memory' });
});

// POST /api/resume/save-version -> Save a new resume version
app.post('/api/resume/save-version', async (req, res) => {
  const { content = '', company = 'Unknown', atsScore = 0, userId = 'agent-zero-user' } = req.body;
  const version = resumeVersions.length + 1;
  const summary = content ? content.substring(0, 120) : `Resume draft v${version} tailored for ${company}`;

  const newVersion = {
    id: `v${version}-${Date.now()}`,
    version, company, atsScore,
    timestamp: new Date().toISOString(),
    summary
  };
  resumeVersions.unshift(newVersion);

  if (supabase) {
    try {
      await supabase.from('documents').insert({
        content: content || summary,
        metadata: { type: 'resume_version', version, company, atsScore, userId }
      });
    } catch (err) {
      console.warn('[ResumeVersions] Supabase save failed:', err.message);
    }
  }

  res.json({ success: true, version: newVersion });
});

// POST /api/recruiter/cheat-sheet -> Generate recruiter cheat-sheet markdown card
app.post('/api/recruiter/cheat-sheet', async (req, res) => {
  const { userId = 'agent-zero-user', company = 'Target Company', jobDescription = '' } = req.body;
  try {
    const { generateRecruiterCheatSheet } = require('../scripts/recruiter_cheat_sheet');
    const result = await generateRecruiterCheatSheet(userId, company, jobDescription);
    res.json(result);
  } catch (err) {
    console.error('[RecruiterCheatSheet] Endpoint failed:', err);
    res.status(500).json({ error: 'Cheat sheet generation failed', message: err.message });
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
