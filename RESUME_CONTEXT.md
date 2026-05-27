# ⚡ AGENT ZERO - HACKATHON CONTEXT HANDBOOK

If you are a future AI model resuming this workspace, **read this handbook first**. It outlines the exact state of our codebase and the plan to build **ResumeVault AI — The Autonomous Job-Applying Agent**.

---

## 📅 PROJECT STATE: Day 1 & Day 2 (100% Completed & E2E Verified)

All Day 1 and Day 2 foundation tasks are fully functional, verified with live API keys, and integrated in the repository:

1. **Supabase URL & DNS Typo Solved:**
   - Correct URL configured is: `https://igmpeciekhaczkagnqin.supabase.co`.
   - All `.env` and `mcp_config.json` parameters are verified.

2. **Supabase Database Schema Upgraded to 3072 Dimensions:**
   - The developer's Gemini API key is valid. The embedding model is `gemini-embedding-2`, which produces **3072-dimensional vector embeddings** (not 768).
   - SQL schema modifications are saved in [supabase/schema.sql](file:///c:/Users/shrey/OneDrive/Desktop/agentathonhackathon/agenthon_/supabase/schema.sql).

3. **Mem0 SDK Search Query Patched:**
   - The modern `mem0ai` client no longer supports top-level `user_id` in `search()`. 
   - We patched the retrieval scripts to query using `{ filters: { user_id: userId } }`.

4. **Robust E2E Validation Tests Passed:**
   - **Persistence Test (`test_persistence.js`)**: stores a fact for a specific user, resets connection context, and successfully retrieves it semantically.
   - **RAG Ingestion (`ingest_documents.js` & `rag_pipeline.js`)**: successfully inserts and retrieves 3072-dimensional documents using cosine similarity.
   - **Parallel Context Construction (`build_context.js`)**: successfully retrieves conversational memory (Mem0) and database RAG (Supabase) in parallel to construct a unified context.

5. **Express API Server Verification:**
   - `memory/memory_api.js` exposes endpoints on port 3001: `/memory/store`, `/memory/retrieve`, `/memory/context`.

---

## 🔮 HACKATHON MISSION: ResumeVault AI (Autonomous Job-Applying Agent)

We have officially locked in the final project: **ResumeVault AI — The Autonomous Job-Applying Agent**. This is our 3-member war plan to dominate the hackathon.

### 💎 Key Innovative Features We Are Building:
*   **One-Click GitHub Ingestion:** Pasting a GitHub URL autonomously scrapes the user's coding history and populates their Mem0 profile.
*   **Isolated Sandbox ATS Parser:** A Python script in the secure sandbox container parses the generated markdown resume, scores keyword density, and guides a Claude quality self-correction loop.
*   **Semantic Gap Analysis:** Job matching discovers missing skills and displays dynamic "10-minute micro-learning cards".
*   **Autonomous Chromium Auto-Apply:** Utilizes `browser-use` (`python_browser_agent.py`) mounted with the user's active session profile to autofill and submit real Greenhouse/Lever application pages.

---

## 📋 DIRECTORY OF ASSETS

*   **HTML War Plan & Checklist:** [RESUMEVAULT_WAR_PLAN.html](file:///c:/Users/shrey/OneDrive/Desktop/agentathonhackathon/RESUMEVAULT_WAR_PLAN.html) (Located in workspace root, print-optimized for PDF).
*   **Implementation Plan:** [implementation_plan.md](file:///c:/Users/shrey/OneDrive/Desktop/agentathonhackathon/agenthon_/implementation_plan.md) (Located in repo root).
*   **Execution Checklist:** [task.md](file:///c:/Users/shrey/OneDrive/Desktop/agentathonhackathon/agenthon_/task.md) (Located in repo root).

---

## 🏁 IMMEDIATELY NEXT STEPS FOR DAY 3 HACKATHON INVOCATION

When you resume this session, immediately execute these tasks strictly in your respective branches:

1.  **Pillar 1 (Person C):** Expose GitHub ingestion routes, refine Mem0 profile timelines, and ensure pgvector RRF searches pull relevant experience.
2.  **Pillar 2 (Person A & B):** Configure career system prompts in `orchestrator/config/agents.json`. Write the `ats_parser.py` script inside the secure sandbox container.
3.  **Pillar 4 (Person B):** Connect `python_browser_agent.py` to auto-fill details and submit.
4.  **Pillar 5 (Person A):** Update `frontend/src/app/dashboard/page.tsx` with a live ATS score meter and dynamic browser automation logs.
