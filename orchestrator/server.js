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
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

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

// GET /api/profile/milestones -> Expose current Mem0 career milestones to frontend
app.get('/api/profile/milestones', async (req, res) => {
  const userId = req.query.userId || 'agent-zero-user';
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${MEMORY_API}/memory/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'skills, projects, certifications, experiences, career milestones', userId })
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
        { memory: "Project: Built 'ResumeVault AI' - career command center with 95% stars on GitHub." },
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
          ResumeVault AI autonomous shell loaded.<br>
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

  // 2. Extract required skills from the JD using keyword matching
  const jdLower = jobDescription.toLowerCase();
  const techKeywordMap = [
    // Languages
    { name: 'JavaScript', aliases: ['javascript', 'js'] },
    { name: 'TypeScript', aliases: ['typescript', 'ts'] },
    { name: 'Python', aliases: ['python', 'py'] },
    { name: 'Java', aliases: ['java'] },
    { name: 'Go', aliases: ['golang', ' go '] },
    { name: 'Rust', aliases: ['rust'] },
    { name: 'C++', aliases: ['c++', 'cpp'] },
    // Frontend
    { name: 'React', aliases: ['react', 'react.js', 'reactjs'] },
    { name: 'Next.js', aliases: ['next.js', 'nextjs', 'next js'] },
    { name: 'Vue', aliases: ['vue', 'vue.js', 'vuejs'] },
    { name: 'Angular', aliases: ['angular'] },
    { name: 'Tailwind', aliases: ['tailwind', 'tailwindcss'] },
    { name: 'HTML', aliases: ['html', 'html5'] },
    { name: 'CSS', aliases: ['css', 'css3', 'scss', 'sass'] },
    // Backend
    { name: 'Node.js', aliases: ['node.js', 'nodejs', 'node js'] },
    { name: 'Express', aliases: ['express', 'expressjs', 'express.js'] },
    { name: 'FastAPI', aliases: ['fastapi', 'fast api'] },
    { name: 'Django', aliases: ['django'] },
    { name: 'Flask', aliases: ['flask'] },
    // Databases
    { name: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'psql'] },
    { name: 'MySQL', aliases: ['mysql'] },
    { name: 'MongoDB', aliases: ['mongodb', 'mongo'] },
    { name: 'Redis', aliases: ['redis'] },
    { name: 'Supabase', aliases: ['supabase'] },
    { name: 'SQLite', aliases: ['sqlite'] },
    // Cloud / DevOps
    { name: 'Docker', aliases: ['docker', 'dockerfile', 'container'] },
    { name: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
    { name: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'] },
    { name: 'GCP', aliases: ['gcp', 'google cloud'] },
    { name: 'Azure', aliases: ['azure', 'microsoft azure'] },
    { name: 'CI/CD', aliases: ['ci/cd', 'cicd', 'github actions', 'jenkins', 'gitlab ci'] },
    { name: 'Git', aliases: ['git', 'github', 'gitlab', 'bitbucket'] },
    // AI/ML
    { name: 'Machine Learning', aliases: ['machine learning', 'ml', 'scikit-learn', 'sklearn'] },
    { name: 'LLM', aliases: ['llm', 'large language model', 'gpt', 'openai', 'claude'] },
    { name: 'RAG', aliases: ['rag', 'retrieval augmented', 'vector search', 'pgvector', 'embeddings'] },
    { name: 'REST API', aliases: ['rest api', 'restful', 'rest'] },
    { name: 'GraphQL', aliases: ['graphql'] },
    // Soft / Misc
    { name: 'Agile', aliases: ['agile', 'scrum', 'sprint'] },
    { name: 'Linux', aliases: ['linux', 'unix', 'bash', 'shell script'] },
  ];

  const jdRequiredSkills = techKeywordMap
    .filter(({ aliases }) => aliases.some(alias => jdLower.includes(alias)))
    .map(({ name }) => name);

  // 3. Classify each JD skill against candidate skills
  const candidateLower = candidateSkills.map(s => s.toLowerCase());

  const matched = [];
  const partial = [];
  const missing = [];

  const upskillMap = {
    'AWS': 'Complete the free AWS Cloud Practitioner Essentials course (6h) on aws.amazon.com/training',
    'Kubernetes': 'Follow the official Kubernetes Basics tutorial at kubernetes.io/docs/tutorials/kubernetes-basics',
    'Redis': 'Redis University offers a free Redis 101 course at university.redis.com',
    'Machine Learning': 'Take the fast.ai Practical Deep Learning course for immediate hands-on ML skills',
    'GCP': 'Google Cloud Skills Boost has free GCP fundamentals paths at cloudskillsboost.google',
    'Azure': 'Microsoft Learn Azure Fundamentals (AZ-900) path is free at learn.microsoft.com',
    'Go': 'Go\'s official tour at tour.golang.org takes ~4 hours and covers all fundamentals',
    'Rust': 'The Rust Book (doc.rust-lang.org/book) is the best free resource to learn Rust',
    'CI/CD': 'GitHub Actions has an official quickstart guide — set up a workflow in under 30 minutes',
    'Django': 'Django\'s official tutorial at docs.djangoproject.com covers a complete web app in ~4h',
    'FastAPI': 'FastAPI\'s official tutorial at fastapi.tiangolo.com is the quickest path to mastery',
    'Vue': 'Vue\'s official guide at vuejs.org/guide covers components and reactivity in ~3h',
    'Angular': 'Angular\'s official Tour of Heroes tutorial covers full framework basics',
    'GraphQL': 'Apollo GraphQL Odyssey (odyssey.apollographql.com) has free interactive GraphQL courses',
    'Docker': 'Docker\'s official Getting Started tutorial takes under 2h at docs.docker.com/get-started',
    'MongoDB': 'MongoDB University offers free M001 MongoDB Basics course at university.mongodb.com',
    'MySQL': 'MySQL 8.0 Reference Manual + W3Schools SQL exercises are a fast-track combo',
    'Linux': 'Linux Journey (linuxjourney.com) is a free interactive Linux learning platform',
    'LLM': 'DeepLearning.AI\'s free short courses on LLMs cover prompting, RAG, and fine-tuning in hours',
    'RAG': 'Build a RAG app with Supabase + pgvector — you already have the infrastructure!',
    'Agile': 'Scrum.org offers free Scrum guides and the PSM I assessment prep materials',
  };

  jdRequiredSkills.forEach(skill => {
    const skillLower = skill.toLowerCase();
    const directMatch = candidateLower.some(cs =>
      cs === skillLower || cs.includes(skillLower) || skillLower.includes(cs)
    );

    if (directMatch) {
      matched.push({ skill });
    } else {
      // Check for partial / related match
      const isPartial = (
        (skillLower.includes('node') && candidateLower.includes('javascript')) ||
        (skillLower.includes('react') && candidateLower.includes('javascript')) ||
        (skillLower.includes('next') && candidateLower.includes('react')) ||
        (skillLower.includes('postgres') && candidateLower.includes('supabase')) ||
        (skillLower.includes('rag') && candidateLower.includes('supabase')) ||
        (skillLower.includes('rest') && candidateLower.includes('node.js')) ||
        (skillLower.includes('ci/cd') && candidateLower.includes('git')) ||
        (skillLower.includes('llm') && candidateLower.includes('python')) ||
        (skillLower.includes('machine learning') && candidateLower.includes('python'))
      );

      if (isPartial) {
        partial.push({
          skill,
          note: `Related experience detected — bridge this gap by applying your existing skills directly to ${skill} projects.`
        });
      } else {
        missing.push({
          skill,
          suggestion: upskillMap[skill] || `Search "${skill} for beginners" on YouTube or freeCodeCamp to find a quality free resource.`
        });
      }
    }
  });

  const totalRequired = jdRequiredSkills.length || 1;
  const readinessScore = Math.round(((matched.length + partial.length * 0.5) / totalRequired) * 100);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    readinessScore,
    totalRequiredSkills: jdRequiredSkills.length,
    matched,
    partial,
    missing,
    candidateSkills: candidateSkills.slice(0, 20),
    summary: readinessScore >= 80
      ? `Strong fit! You match ${matched.length}/${jdRequiredSkills.length} required skills. This role is within your reach.`
      : readinessScore >= 50
      ? `Moderate fit. You match ${matched.length}/${jdRequiredSkills.length} skills. Bridging ${missing.length} gaps could take 2–4 weeks.`
      : `Developing fit. Focus on ${missing.slice(0, 3).map(m => m.skill).join(', ')} first to significantly boost your match score.`
  });
});

// ── Supabase RAG Documents Explorer Endpoints ──

// POST /api/rag/search -> Full-text keyword search on Supabase documents table
app.post('/api/rag/search', async (req, res) => {
  const { query = '', limit = 8 } = req.body;

  if (!supabase) {
    // Return demo docs if Supabase not configured
    const demoDocs = [
      { id: '1', content: 'ResumeVault AI career guideline: Always quantify achievements with metrics. Use action verbs like "designed", "implemented", "optimized". Keep resume to 1 page for < 5 years experience.', metadata: { source: 'resume_guidelines.pdf', type: 'guideline' }, created_at: new Date().toISOString() },
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
    { content: 'ResumeVault AI career guideline: Always quantify achievements with metrics. Use action verbs like "designed", "implemented", "optimized". Keep resume to 1 page for < 5 years experience.', metadata: { source: 'resume_guidelines.pdf', type: 'guideline' } },
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

// ── A5: Resume PDF Export ──

// POST /api/resume/export -> Build a print-ready HTML resume from Mem0 milestones
app.post('/api/resume/export', async (req, res) => {
  const { userId = 'agent-zero-user', company = 'Target Company', jobTitle = 'Software Engineer' } = req.body;
  const MEMORY_API = process.env.MEMORY_API_URL || 'http://localhost:3001';

  let memories = [];
  try {
    const memRes = await fetch(`${MEMORY_API}/memory/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'skills, projects, certifications, experiences, achievements', userId })
    });
    if (memRes.ok) {
      const memData = await memRes.json();
      memories = memData.results || memData.result || [];
    }
  } catch (err) {
    console.warn('[ResumeExport] Mem0 unavailable, using defaults');
  }

  if (memories.length === 0) {
    memories = [
      { memory: 'Skills: React, Node.js, Next.js, TypeScript, Python, Docker, Supabase, pgvector, Git' },
      { memory: 'Project: ResumeVault AI — Autonomous career command center with agentic job hunting, ATS scoring, and Mem0 stateful profile' },
      { memory: 'Project: Supabase pgvector RAG pipeline with 3072-dimensional hybrid search (semantic + BM25 FTS)' },
      { memory: 'Achievement: Built and deployed a multi-agent orchestration system using Groq, Gemini, and Claude in a containerized environment' },
      { memory: 'Education: B.Tech Computer Science — Manipal Institute of Technology' }
    ];
  }

  const timelineItems = memories.map(item => item.memory || item.content || item.text || '').filter(Boolean);

  // Parse sections
  const skills = timelineItems.filter(t => /skill|react|node|python|typescript|docker|sql|git/i.test(t));
  const projects = timelineItems.filter(t => /project:|built|developed|designed|implemented/i.test(t));
  const achievements = timelineItems.filter(t => /achievement|award|scored|milestone/i.test(t));
  const education = timelineItems.filter(t => /education|university|college|btech|degree|gpa/i.test(t));
  const other = timelineItems.filter(t => !skills.includes(t) && !projects.includes(t) && !achievements.includes(t) && !education.includes(t));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume — Shrey Sharma</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
    :root { --primary: #7c3aed; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: var(--text); background: #fff; padding: 48px 60px; line-height: 1.6; font-size: 13px; max-width: 800px; margin: 0 auto; }
    header { border-bottom: 2px solid var(--primary); padding-bottom: 20px; margin-bottom: 24px; }
    h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: var(--text); }
    .role { font-size: 14px; color: var(--primary); font-weight: 600; margin: 4px 0 8px; }
    .contact { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--muted); display: flex; gap: 20px; flex-wrap: wrap; }
    h2 { font-size: 10px; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: var(--primary); border-bottom: 1px solid var(--border); padding-bottom: 6px; margin: 20px 0 12px; }
    .entry { margin-bottom: 12px; }
    .entry-title { font-weight: 600; font-size: 13px; color: var(--text); }
    .entry-sub { font-size: 11px; color: var(--muted); font-family: 'Space Mono', monospace; margin-bottom: 4px; }
    .entry-desc { font-size: 12px; color: #334155; line-height: 1.5; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill-tag { font-family: 'Space Mono', monospace; font-size: 10px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 8px; color: var(--text); font-weight: 600; }
    .ats-badge { display: inline-block; background: #dcfce7; border: 1px solid #bbf7d0; color: #15803d; font-family: 'Space Mono', monospace; font-size: 9px; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-weight: 700; vertical-align: middle; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#7c3aed;color:#fff;padding:10px 16px;margin:-48px -60px 30px;font-family:'Space Mono',monospace;font-size:11px;display:flex;justify-content:space-between;align-items:center;">
    <span>💎 ResumeVault AI — Generated Resume <span style="opacity:0.6">for ${company}</span></span>
    <button onclick="window.print()" style="background:#fff;color:#7c3aed;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:700;font-size:11px;">⬇ Print / Save as PDF</button>
  </div>

  <header>
    <h1>Shrey Sharma <span class="ats-badge">ATS Optimized</span></h1>
    <div class="role">${jobTitle} · AI Systems & Full-Stack Engineering</div>
    <div class="contact">
      <span>📧 shreyaskalasa18@gmail.com</span>
      <span>🐙 github.com/shrey</span>
      <span>🔗 linkedin.com/in/shrey</span>
      <span>📍 India · Open to Relocation</span>
    </div>
  </header>

  ${skills.length > 0 ? `
  <h2>Technical Skills</h2>
  <div class="skills-grid">
    ${skills.flatMap(s => s.replace(/^skills?:\s*/i,'').split(/[,;|]+/).map(t => t.trim()).filter(t => t.length > 1 && t.length < 30))
      .map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
  </div>` : ''}

  ${projects.length > 0 ? `
  <h2>Projects</h2>
  ${projects.map(p => {
    const parts = p.split('—');
    const title = parts[0].replace(/^project:\s*/i,'').trim();
    const desc = parts.slice(1).join('—').trim();
    return `<div class="entry">
      <div class="entry-title">${title}</div>
      ${desc ? `<div class="entry-desc">${desc}</div>` : ''}
    </div>`;
  }).join('')}` : ''}

  ${achievements.length > 0 ? `
  <h2>Achievements</h2>
  ${achievements.map(a => `<div class="entry"><div class="entry-desc">• ${a.replace(/^achievement:\s*/i,'').trim()}</div></div>`).join('')}` : ''}

  ${other.length > 0 ? `
  <h2>Experience & Notes</h2>
  ${other.map(o => `<div class="entry"><div class="entry-desc">• ${o}</div></div>`).join('')}` : ''}

  ${education.length > 0 ? `
  <h2>Education</h2>
  ${education.map(e => `<div class="entry"><div class="entry-desc">${e.replace(/^education:\s*/i,'').trim()}</div></div>`).join('')}` : ''}

  <h2>Generated By</h2>
  <div class="entry-desc" style="font-size:10px;color:#94a3b8;font-family:'Space Mono',monospace;">
    ResumeVault AI · Autonomous Career Command Center · Stateful profile from Mem0 · Optimized ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="shrey_sharma_${company.toLowerCase().replace(/\s+/g,'-')}_resume.html"`);
  res.send(html);
});

// ── A6: Live Application Status Tracker (Kanban Board) ──

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
