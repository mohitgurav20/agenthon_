import asyncio
from browser_use import Agent
from langchain_openai import ChatOpenAI
import sys
import json
import os

# Ensure the OPENAI_API_KEY is set in environment (or adapt to Gemini/Groq as needed)
# For Browser Use, GPT-4o or Claude 3.5 Sonnet are usually best.

async def run_browser_task(url, task_description):
    try:
        # Initialize the LLM for browser-use (requires API key in ENV)
        llm = ChatOpenAI(model="gpt-4o")
        
        full_task = f"Go to {url}. {task_description}"
        
        agent = Agent(
            task=full_task,
            llm=llm,
        )
        
        result = await agent.run()
        
        return {
            "success": True,
            "content": result.final_result(),
            "url": url
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing URL or Task arguments"}))
        sys.exit(1)
        
    url_arg = sys.argv[1]
    task_arg = sys.argv[2]
    
    result_dict = asyncio.run(run_browser_task(url_arg, task_arg))
    print(json.dumps(result_dict))
