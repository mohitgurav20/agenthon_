---
name: memory-retrieval
description: Skill for retrieving user memory and knowledge base context before answering
---

# Memory Retrieval Skill

## Instruction

Before answering any user question, you MUST run a combined context retrieval to pull relevant memories from the Mem0 MCP server and structured knowledge from the Supabase RAG n8n workflow.

1. Take the user's input/query and the current `user_id`.
2. Execute the Mem0 MCP `search_memories` tool (or trigger the n8n memory workflow webhook) to retrieve the top 5 relevant user memories.
3. Execute the Supabase RAG workflow webhook to fetch the top 3 relevant documents using pgvector.
4. Inject the combined results into your context before formulating a response.
5. If no memories exist, proceed without them gracefully.

**DO NOT** answer the user's question without first checking for context, unless it is a generic greeting.
