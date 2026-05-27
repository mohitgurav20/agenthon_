# ResumeVault AI — Execution Task Checklist

This is our active task checklist. As we work, we will update these tasks to track our progress towards a completely working, premium career agent platform.

- `[x]` **Pillar 1: Career Database & Profile Ingestion**
    - `[x]` Refine agent routing logic in `orchestrator/router.js` to parse career/profile intents.
    - `[x]` Connect Next.js chat updates directly to **Mem0** and verify stateful fact storage.
    - `[x]` Implement GitHub One-Click Ingestion scaper connector.

- `[x]` **Pillar 2: Resume Tailoring & Sandbox Simulator**
    - `[x]` Update Agent Prompts in `orchestrator/config/agents.json` to configure specialized career personas.
    - `[x]` Create Python ATS Parser (`tools/ats_parser.py`) and local Node ATS analyzer (`tools/ats-analyzer.js`) to guarantee resilient scoring.
    - `[x]` Integrate the ATS parser script inside `tools/index.js` as the 'ats_evaluate' tool.
    - `[x]` Configure the Claude quality self-correction loop in `orchestrator/agents/validator-agent.js`.

- `[x]` **Pillar 3: Job Discovery**
    - `[x]` Integrated Tavily search tool specifically to crawl live Greenhouse and Lever job boards based on profile skills.
    - `[x]` Built the semantic gap analysis logic comparing target job requirements to Mem0 user profiles.

- `[x]` **Pillar 4: Automated Application**
    - `[x]` Updated tools/python_browser_agent.py and browser-agent-launcher.js to mount Chrome session directories.
    - `[x]` Added form selectors and autofilling logic for Greenhouse and Lever boards.
    - `[x]` Implemented dynamic cover letter and on-the-fly custom essay answering inside the browser script.

- `[x]` **Pillar 5: Next-Gen Dashboard UI**
    - `[x]` Redesign the dashboard page (`frontend/src/app/dashboard/page.tsx`) with premium obsidian styling.
    - `[x]` Added visual panels for: Live ATS score meter, Mem0 career database timeline, active Tavily job search results, and real-time Chromium browser agent logs terminal.

---

## ⚡ Post-Integration Feature Boost Roadmap (Phase 2 & 3)

This section maps our next-generation visual and tool features to be completed side-by-side.

### 🧠 **Person A — Orchestrator & Front-End Checklist**
- `[x]` **Task A1: AI-Generated Interactive Web Portfolios**
    - `[x]` Expose a port 3002 API endpoint `GET /api/portfolio/generate` to dynamically construct a single-page HTML portfolio.
    - `[x]` Read candidate milestones and facts from the Mem0 API on port 3001.
    - `[x]` Synthesize professional project layouts and styling, saving it to `agenthon_/public/portfolio.html` for presentation.
- `[x]` **Task A2: Resume A/B Funnel Analytics & Tab**
    - `[x]` Expose an Express endpoint `GET /api/analytics/funnel` returning simulated/real conversion ratios across resume drafts.
    - `[x]` Redesign the **Metrics tab** in `frontend/src/app/dashboard/page.tsx` to render glowing charts and funnel stats.
- `[x]` **Task A3: Skill Gap Analyzer Panel**
    - `[x]` Expose a `POST /api/skills/gap-analysis` endpoint that accepts a job description and compares it against the candidate's Mem0 profile skills.
    - `[x]` Build a visual panel in the dashboard showing matched skills (✅ green), partial matches (⚠️ yellow), and missing skills (❌ red) with AI-powered upskilling suggestions for each gap.
- `[x]` **Task A4: Supabase Documents RAG Explorer Drawer**
    - `[x]` Implement a slide-out drawer on the frontend to search, view, and query documents stored in the Supabase pgvector store.
- `[x]` **Task A5: One-Click Resume PDF Export**
    - `[x]` Add `POST /api/resume/export` endpoint that builds a styled, print-ready HTML resume from Mem0 milestones.
    - `[x]` Add a **"⬇ Download Resume PDF"** button in the dashboard that fetches the resume HTML, downloads it, and opens a print dialog for PDF save.
- `[x]` **Task A6: Live Application Status Tracker (Kanban Board)**
    - `[x]` Build a Kanban-style status board in the dashboard: `Applied → Recruiter Viewed → Interview Scheduled → Offer`.
    - `[x]` Persist application cards in Supabase `agent_outputs` table and display them with drag-friendly status progression.
- `[x]` **Task A7: Resume Version History in RAG Drawer**
    - `[x]` Save each ATS-scored resume draft to the Supabase `documents` table with metadata (timestamp, company, ATS score, version number).
    - `[x]` Show a **Version History** tab in the RAG Explorer drawer listing all saved resume versions with scores and a restore/preview button.

### ⚙️ **Person B — Tools & Polish Checklist**
- `[x]` **Task B1: ElevenLabs Recruiter Voice Feedback**
    - `[x]` Integrate text-to-speech inside `tools/voice-interface.js` and hook up your key.
    - `[x]` Trigger dynamic verbal confirmation voice alerts when form autofilling or submission tasks succeed in the browser.
- `[x]` **Task B2: LinkedIn Job Board Scraper Extension**
    - `[x]` Add custom JSDOM parsing rules in `tools/web-scraper.js` to extract public LinkedIn job details, requirements, and titles cleanly.
- `[x]` **Task B3: Human-in-the-Loop Resilient Pause Interventions**
    - `[x]` Update `tools/browser-agent-launcher.js` to pause when a CAPTCHA is detected, notifying the orchestrator and resuming upon solution.
- `[x]` **Task B4: WhatsApp Status Alert Integration**
    - `[x]` Connect Twilio inside `tools/whatsapp-notifier.js` to send real-time job application receipts, including match score and company name, directly to the candidate's phone.

### 💾 **Person C — Database & Memory Checklist**
- `[x]` **Task C1: pgvector RAG Reciprocal Rank Fusion (RRF) Hybrid Search**
    - `[x]` Upgrade search functions in `scripts/rag_pipeline.js` or memory API routes to perform hybrid search.
    - `[x]` Combine semantic vector scores with standard Postgres Full-Text Search (keyword matching) for maximum query precision.
- `[x]` **Task C2: Scheduled Semantic Memory Deduplication Cron**
    - `[x]` Setup a background interval scheduler inside `memory/memory_api.js`.
    - `[x]` Trigger semantic memory deduplication every 10 minutes to auto-consolidate overlapping skills/achievements in Mem0.
- `[x]` **Task C3: Supabase PgBouncer Pool Optimization**
    - `[x]` Harden connection strings and pool parameters inside the Supabase client setups to support high load.
- `[x]` **Task C4: Dynamic RAG Recruiter "Cheat-Sheet" Generator**
    - `[x]` Build an endpoint/script matching company culture guidelines with candidate achievements.
    - `[x]` Compile and save a tailored Recruiter Cheat-Sheet markdown card.
