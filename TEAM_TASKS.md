# Agent Zero — Team Task Assignment & Roadmap
This document contains the project status summary, areas for code strengthening, and assigned preparation tasks for **Person A (Orchestrator Lead)**, **Person B (Tools Lead)**, and **Person C (Memory Lead)**. Use this roadmap to align the team and optimize the codebase before the hackathon problem statement is announced!

---

## 📊 Current Project Status
We have successfully built a state-of-the-art, fully integrated AI agent framework:
1. **Multi-Agent Orchestrator (Person A)**: Features a Llama-3.1 intent router, Gemini Research and Action agents, a Claude-based Output Validator with strict criteria, Langfuse observability tracking, and a Google Cloud remote sandbox API terminal.
2. **Dynamic Tool Registry (Person B)**: 12 pre-integrated tools including Web Search (Tavily), Web Scraper, Email, WhatsApp, Phone Calls (Twilio), Data Analytics, Voice Interface (ElevenLabs), Trigger.dev jobs, and the **Skyvern Browser Automation Form-Filling tool**.
3. **Hybrid Long-Term Memory (Person C)**: Integrated Mem0 for automatic user personalization alongside Supabase pgvector hybrid semantic document search (RAG) and live realtime memory streaming.
4. **observability Dashboard**: A Next.js dual-runtime frontend that lets you toggle between a step-by-step metrics console and the native CopilotKit chat interface.

---

## 🛠️ Areas to Strengthen (Before Hackathon Kickoff)
To ensure the system is robust and bulletproof under pressure, the team should address these technical gaps:
- **Error Handling & Fallbacks**: Ensure agents can gracefully degrade if external APIs (Tavily, Supabase, Twilio) fail or time out.
- **Dockerization & Deployment**: Set up a universal `docker-compose` configuration to boot up the entire backend, frontend, and database locally with a single command.
- **API Keys & Mock Modes**: Build a "Mock Mode" flag in `.env` so you can test all features (like voice call, SMS, WhatsApp, or Skyvern) without spending money or hitting API limits.
- **Unified Startup script**: Combine the backend, database migrations, and Next.js frontend into a single orchestrator startup pipeline.

---

## 📋 Teammate Task Assignments

### 🧠 Person A — Orchestrator Lead (Current User)
*Role: Maintain routing logic, LLM prompt engineering, security, and main dashboard execution.*

- [ ] **Dockerize the Infrastructure**: Create a root-level `Dockerfile` and `docker-compose.yml` to orchestrate Next.js, the Node.js backend, and any local database services.
- [ ] **Strengthen Router Fallbacks**: Enhance the router so that if the Llama-3.1 route fails, it automatically falls back to a default LLM classification without crashing.
- [ ] **Configurable System Persona**: Abstract the agent personas out of `orchestrator/agents/*.js` into a centralized `orchestrator/config/agents.json` file. When the problem statement arrives, you can rename and re-purpose the agents in 10 seconds.
- [ ] **Validator Strictness Setting**: Add a slider or configuration value in the UI to dynamically adjust the Claude Validator confidence threshold (currently hardcoded at 70%).

---

### ⚙️ Person B — Tools Lead
*Role: Expand, secure, and debug the tool execution registry, background jobs, and API integrations.*

- [ ] **Implement Tool "Mock Mode"**: Create standard mock responses inside `tools/` for Twilio (calls/SMS), WhatsApp, ElevenLabs (audio), and Skyvern so you can run the entire workflow end-to-end for free during dry runs.
- [ ] **Skyvern Task Polling & Webhooks**: Currently, `skyvern-agent.js` queues the task but does not poll for the final results. Write a polling loop (or an Express webhook receiver) to retrieve the finished browser automation result.
- [ ] **Rate Limiting & Safety**: Implement a tool invocation rate-limiter to protect against infinite loops where an action agent calls the same tool repeatedly.
- [ ] **Trigger.dev Sync**: Finish setting up Trigger.dev background task event handling so complex, long-running processes (e.g. executing scraping on 50 websites) run in the background.

---

### 💾 Person C — Memory Lead
*Role: Manage Supabase vector schema, RAG indexers, Mem0 personalization, and search performance.*

- [ ] **Batch RAG Ingest Script**: Write a utility script in `scripts/ingest_docs.js` that reads all files in a `knowledge_base/` folder, splits them into semantic chunks, generates vectors, and batches them into Supabase.
- [ ] **Strengthen Hybrid Search Queries**: Optimize the pgvector queries in `memory/memory_api.js` to combine standard keyword (BM25) search and vector semantic search with a Reciprocal Rank Fusion (RRF) ranker.
- [ ] **Auto-Memory Cleanup Routine**: Create a clean-up API endpoint `DELETE /api/memory/clear` that allows the user or the orchestrator to flush active sessions and memory collections in between benchmarks.
- [ ] **Local DB Migration Scripts**: Provide a standard local setup guide or script to boot up a local Postgres instance with the `pgvector` extension enabled, so you don't rely solely on the cloud Supabase project during development.
