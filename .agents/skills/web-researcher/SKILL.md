# Web Researcher Skill

**Description**: Auto-activates when the user asks a question requiring current facts, news, or deep internet research.

**Trigger Phrases**:
- "search the web"
- "what is the latest on"
- "find information about"
- "who is"
- "current news"

**Instructions**:
When facts or current information are needed:
1. Identify the core entity or concept the user is asking about.
2. Formulate an optimized search query.
3. Execute the `web_search` tool (Tavily) to retrieve the top 3-5 results.
4. Extract key information from the returned results.
5. Synthesize a comprehensive answer.
6. CITE YOUR SOURCES ALWAYS. Append a "Sources:" section at the bottom of your response with the URLs used. Prefer recent results.

**Tools Available**:
- `web_search`: Provide `query` as string. Returns structured results.

**Rules**:
- Do NOT guess current facts. Always use the search tool if you are unsure.
- If the search tool fails, explicitly inform the user that the web search failed.
- Do NOT hallucinate URLs. Only cite URLs returned by the search tool.
