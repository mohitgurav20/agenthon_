# ResumeVault AI — Execution Task Checklist

This is our active task checklist. As we work, we will update these tasks to track our progress towards a completely working, premium career agent platform.

- `[ ]` **Pillar 1: Career Database & Profile Ingestion**
    - `[ ]` Refine agent routing logic in `orchestrator/router.js` to parse career/profile intents.
    - `[ ]` Connect Next.js chat updates directly to **Mem0** and verify stateful fact storage.
    - `[ ]` Implement GitHub One-Click Ingestion scaper connector.

- `[x]` **Pillar 2: Resume Tailoring & Sandbox Simulator**
    - `[x]` Update Agent Prompts in `orchestrator/config/agents.json` to configure specialized career personas.
    - `[x]` Create Python ATS Parser (`tools/ats_parser.py`) and local Node ATS analyzer (`tools/ats-analyzer.js`) to guarantee resilient scoring.
    - `[x]` Integrate the ATS parser script inside `tools/index.js` as the 'ats_evaluate' tool.
    - `[x]` Configure the Claude quality self-correction loop in `orchestrator/agents/validator-agent.js`.

- `[ ]` **Pillar 3: Job Discovery**
    - `[ ]` Integrate Tavily search tool specifically for crawling live Greenhouse and Lever job boards.
    - `[ ]` Build the semantic gap analysis logic comparing target jobs to Mem0 profiles.

- `[ ]` **Pillar 4: Automated Application**
    - `[ ]` Update `tools/python_browser_agent.py` to launch Chromium with the user's active session profile directory.
    - `[ ]` Add form field selectors for auto-filling Greenhouse and Lever boards.
    - `[ ]` Implement dynamic cover letter and custom question answering within the browser script.

- `[x]` **Pillar 5: Next-Gen Dashboard UI**
    - `[x]` Redesign the dashboard page (`frontend/src/app/dashboard/page.tsx`) with premium obsidian styling.
    - `[x]` Added visual panels for: Live ATS score meter, Mem0 career database timeline, active Tavily job search results, and real-time Chromium browser agent logs terminal.
