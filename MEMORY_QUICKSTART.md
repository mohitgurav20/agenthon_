# ⚡ AGENT ZERO - MEMORY & STATEFUL AGENT QUICKSTART

Welcome to the **Memory & Data Integration Layer** for Person A (Orchestrator) and Person B (Tools)! This handbook shows how to seamlessly integrate persistent conversational memory (Mem0), vector document search (Supabase pgvector), and stateful perpetual reasoning agents (Letta) into the orchestrator pipeline.

---

## 🚀 How to Run the Memory Server
To spin up the Express API server exposing all memory and stateful agent endpoints, run:
```bash
node memory/memory_api.js
```
The server binds to **Port 3001** and will log the active API endpoints:
- `POST http://localhost:3001/memory/store`
- `POST http://localhost:3001/memory/retrieve`
- `POST http://localhost:3001/memory/context`
- `POST http://localhost:3001/memory/letta/agent`
- `POST http://localhost:3001/memory/letta/message`
- `GET  http://localhost:3001/memory/letta/agent/:id/memory`

---

## 🛠️ Integration Endpoints & Payloads

### 1. Store Fact / Conversation Segment (Mem0)
Use this after every assistant response to let the agent auto-extract and remember facts about the user.
* **Endpoint:** `POST /memory/store`
* **JSON Payload:**
```json
{
  "text": "User prefers high-contrast dark mode UI layouts.",
  "userId": "agent-zero-user"
}
```
* **JavaScript Fetch Snippet:**
```javascript
const storeFact = await fetch('http://localhost:3001/memory/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        text: "User prefers high-contrast dark mode UI layouts.",
        userId: "agent-zero-user"
    })
});
const result = await storeFact.json();
console.log("Store Result:", result.success);
```

---

### 2. Retrieve Combined Context (Mem0 Memories + Supabase pgvector RAG)
Use this **before** formulating any LLM response. It queries conversational history and the technical knowledge base in parallel and returns a unified markdown context block.
* **Endpoint:** `POST /memory/context`
* **JSON Payload:**
```json
{
  "query": "Which UI theme should I display for this user?",
  "userId": "agent-zero-user"
}
```
* **JavaScript Fetch Snippet:**
```javascript
const getContext = await fetch('http://localhost:3001/memory/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: "Which UI theme should I display for this user?",
        userId: "agent-zero-user"
    })
});
const { context } = await getContext.json();
console.log("Unified Context block:\n", context);
```
* **Unified Context Output Format:**
```markdown
USER CONTEXT:

[Conversational Memories]:
1. User prefers high-contrast dark mode UI layouts.

[Knowledge Base]:
1. System theme guidelines dictate dark theme is enabled by passing custom high-contrast properties...
```

---

### 3. Stateful Perpetually-Learning Agent (Letta / MemGPT)
Use Letta when you need a stateful assistant that maintains its own permanent conversation history, persona, and human information blocks across restarts.

#### **A. Create a Letta Agent**
* **Endpoint:** `POST /memory/letta/agent`
* **JSON Payload:**
```json
{
  "name": "Stateful Orchestrator",
  "systemPrompt": "You are a stateful assistant that persists persona and human context blocks."
}
```
* **Response:** `{ "success": true, "result": { "id": "agent-miapo6wrg", "name": "...", "system": "..." } }`

#### **B. Send Message to Letta Agent**
Sends a new message to the stateful thread. The agent automatically reviews its own context window and updates its memory blocks.
* **Endpoint:** `POST /memory/letta/message`
* **JSON Payload:**
```json
{
  "agentId": "agent-miapo6wrg",
  "messageText": "Hello! Please remember that my name is Mohit."
}
```

#### **C. Retrieve Agent Core Memory**
Fetches the agent's current persistent persona and human data blocks.
* **Endpoint:** `GET /memory/letta/agent/:id/memory`
* **Response Example:**
```json
{
  "success": true,
  "result": {
    "core_memory": {
      "persona": "Name: Stateful Orchestrator...",
      "human": "User preferences: Name is Mohit."
    }
  }
}
```

---

## 🛡️ Robust Offline / Mock Fallback Protection
If the local Letta server (`http://localhost:8283`) is offline, the client automatically switches to **High-Fidelity Simulated Mode**. All endpoints will return standard mock schemas with `"simulated": true` flags, ensuring the orchestrator never breaks or crashes during the live hackathon run.

---
🏆 **Person C (Memory & Data) Stack is 100% Pre-Built & E2E Verified. Happy Integrating!**
