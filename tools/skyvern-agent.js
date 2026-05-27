const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

/**
 * ============================================================
 * SKYVERN AGENT TOOL
 * ============================================================
 * Person B Secret Weapon: Agent fills real forms automatically.
 * Sends tasks to the Skyvern cloud API to navigate websites
 * and interact with forms or dynamic UI without custom code.
 * ============================================================
 */

/**
 * Execute a Skyvern task
 * @param {object} params 
 * @param {string} params.url - The URL to navigate to
 * @param {string} params.prompt - Natural language instruction of what to do on the page
 * @returns {Promise<object>}
 */
async function executeSkyvernTask({ url, prompt }) {
  if (!process.env.SKYVERN_API_KEY) {
    throw new Error('SKYVERN_API_KEY is not defined in .env');
  }

  console.log(`[SkyvernAgent] Initializing task for URL: ${url}`);
  console.log(`[SkyvernAgent] Prompt: ${prompt}`);

  try {
    const response = await axios.post(
      'https://api.skyvern.com/v1/tasks',
      {
        url,
        webhook_callback_url: null, // Can set this to your n8n webhook or backend endpoint
        navigation_goal: prompt,
        proxy_location: 'US',
        // Example configuration parameters based on typical Skyvern usage
      },
      {
        headers: {
          'x-api-key': process.env.SKYVERN_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // This typically returns a task ID that processes asynchronously
    const taskId = response.data.task_id;
    console.log(`[SkyvernAgent] Task created successfully. Task ID: ${taskId}`);

    return {
      success: true,
      taskId,
      message: "Skyvern task successfully queued in the cloud.",
      statusUrl: `https://api.skyvern.com/v1/tasks/${taskId}`
    };
    
  } catch (error) {
    console.error('[SkyvernAgent] API Error:', error.response?.data || error.message);
    throw new Error(`Skyvern failed to execute task: ${error.response?.data?.error || error.message}`);
  }
}

module.exports = {
  executeSkyvernTask
};
