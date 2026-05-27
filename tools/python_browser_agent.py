import asyncio
from browser_use import Agent
from browser_use.browser.browser import Browser, BrowserConfig
from langchain_openai import ChatOpenAI
import sys
import json
import os

# Ensure the OPENAI_API_KEY is set in environment (or adapt to Gemini/Groq as needed)
# For Browser Use, GPT-4o or Claude 3.5 Sonnet are usually best.

async def run_browser_task(url, task_description):
    try:
        # 1. Mount Active Chrome Profile
        # This allows the browser to open already logged into LinkedIn/Naukri
        local_app_data = os.environ.get('LOCALAPPDATA', '')
        user_data_dir = os.path.join(local_app_data, 'Google', 'Chrome', 'User Data')
        
        browser = Browser(
            config=BrowserConfig(
                # Mount the default profile. (Note: Chrome must be closed on the host for this to work)
                chrome_instance_path='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' if os.path.exists('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') else None,
                extra_chromium_args=[f'--user-data-dir={user_data_dir}', '--profile-directory=Default']
            )
        )

        llm = ChatOpenAI(model="gpt-4o")
        
        # 2. ATS Autofill Logic (Greenhouse / Lever / LinkedIn / Naukri)
        ats_instructions = (
            "\n\n[ATS STANDARD PROTOCOL]: "
            "1. IF GREENHOUSE/LEVER: Locate 'Resume/CV' input and upload the PDF. Map First Name, Last Name, Email. Click 'Submit Application'. "
            "2. IF LINKEDIN: Use the 'Easy Apply' button. Follow the modal steps, upload the PDF if asked, and click 'Submit'. "
            "3. IF NAUKRI: Click 'Apply'. If a form appears, fill basic details and attach the resume. "
            "\n\n[HUMAN-IN-THE-LOOP PROTOCOL]: "
            "If you encounter a CAPTCHA, Cloudflare check, or 2FA login screen, DO NOT try to solve it. "
            "Immediately stop executing actions and output the exact text: 'HUMAN_INTERVENTION_REQUIRED'. "
            "The system will alert the user to solve it in the visible Chromium window."
        )
        
        full_task = f"Go to {url}. {task_description}. {ats_instructions}"
        
        agent = Agent(
            task=full_task,
            llm=llm,
            browser=browser
        )
        
        result = await agent.run()
        await browser.close()
        
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
