# AGENTS.md - Team Contract

This document defines the exact JSON format for every agent's input and output to prevent integration failures.

## Orchestrator Agent
**Input (from User/UI):**
```json
{
  "session_id": "string",
  "user_input": "string",
  "context": "optional json block"
}
```
**Output (Delegation):**
```json
{
  "target_agent": "research | action",
  "instructions": "string",
  "parameters": {}
}
```
**Output (Final to User):**
```json
{
  "response": "string",
  "confidence": 0-100,
  "sources_used": [],
  "validationScore": 0-100,
  "performance": {
    "totalMs": 0,
    "classificationMs": 0,
    "agentMs": 0
  }
}
```

## Research Agent
**Output:**
```json
{
  "findings": "string",
  "memories_retrieved": [
    {"id": "string", "content": "string", "score": 0.0}
  ]
}
```

## Action Agent
**Output:**
```json
{
  "status": "success | failure",
  "message": "string",
  "action_logs": [
    {"toolName": "string", "success": true, "latencyMs": 0}
  ]
}
```

## Validator Agent (Claude)
**Output:**
```json
{
  "validationScore": 0-100,
  "passed": true,
  "feedback": "string",
  "issues": []
}
```

## A2A Protocol (JSON-RPC 2.0)
**Supported Methods:**
- `agent/capabilities` — Returns registered tools, supported models, and agent metadata.
- `message/send` — Routes a message through the full orchestrator pipeline and returns the validated response.

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "method": "agent/capabilities | message/send",
  "params": { "message": "string" },
  "id": 1
}
```

**Agent Card (GET /.well-known/agent.json):**
```json
{
  "schema": "https://linuxfoundation.org/schemas/a2a/agent-card.json",
  "name": "Agent Zero",
  "version": "2.0.0",
  "capabilities": {
    "models": ["Gemini 1.5 Pro", "Claude 3.5 Sonnet", "Llama 3.1 70B (Groq)"],
    "tools": ["web_search", "web_scrape", "send_email", "send_whatsapp", "rag_process_doc", "rag_search", "analyze_image", "generate_report", "make_phone_call", "analyze_data", "text_to_speech", "run_remote_sandbox"]
  }
}
```

## Managed Agents API (Remote Sandbox)
**Input:**
```json
{
  "input": "python3 -c 'print(hello)'",
  "environmentId": "remote"
}
```
**Output:**
```json
{
  "success": true,
  "environment": "remote",
  "output": "[stdout] ...",
  "logs": ["[remote-sandbox] Container started.", "..."],
  "state": "COMPLETED"
}
```
