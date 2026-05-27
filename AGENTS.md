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
  "sources_used": []
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
  "action_logs": []
}
```
