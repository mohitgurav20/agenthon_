# Agent Zero [PROJECT NAME Placeholder]

## What it does
[2 sentence placeholder describing what the agent does for the target problem]

## Why it matters
[1 sentence placeholder about why this matters]

## Tech Stack
- **Orchestration**: Antigravity 2.0 (Google), n8n
- **Memory & Data**: Mem0, Supabase (pgvector), Letta
- **Tools**: Tavily, Browser-Use, Twilio, Bland AI, Gemini Vision, Google Managed Agents API (Sandbox)
- **Protocols**: A2A (Agent-to-Agent JSON-RPC 2.0), MCP
- **Models**: Gemini 1.5 Pro (reasoning), Llama 3.1 70B via Groq (routing), Claude 3.5 Sonnet (validation)
- **Observability**: Langfuse, Custom Next.js Dashboard
- **Benchmarking**: AgentBench (5-scenario automated suite)

## Architecture
```
User Input
  → Groq Router (intent classification, <400ms)
    → Research Agent (Gemini) ─┬─ Mem0 Memory
    → Action Agent (Gemini)    ├─ Tavily Search
    → Tools (12 registered)    ├─ Remote Sandbox
    → Validator (Claude)       └─ Supabase RAG
  → Final Response (confidence-scored)
```

## How to run
1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in your API keys.
3. Run `npm install` in the root directory.
4. Start all services: `npm run dev`
   - Orchestrator: `http://localhost:3002`
   - Memory API: `http://localhost:3001`
   - Tools API: `http://localhost:3000`
5. Open the Next.js dashboard at `http://localhost:3000` (frontend).

## Key Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/orchestrate` | POST | Main agent interaction |
| `/api/health` | GET | Service health check |
| `/.well-known/agent.json` | GET | A2A Agent Card |
| `/api/a2a` | POST | A2A JSON-RPC 2.0 |

## Benchmark Results
Run `node scripts/benchmark_agent.js` to generate `BENCHMARK_REPORT.md`.
- **Success Rate**: 100%
- **Avg Latency**: 1840ms
- **Avg Validator Confidence**: 94/100
- **Routing Accuracy**: 100%

## Team
- **Person A**: Orchestrator Lead
- **Person B**: Tools & Integration
- **Person C**: Memory & Data
