require('dotenv').config({ path: 'c:/Users/chinm/Desktop/agebtic ai/agenthon_/.env' });
const axios = require('axios');

async function verifyKeys() {
  console.log("Verifying New API Keys...");

  // 1. Verify Trigger.dev
  try {
    const triggerKey = process.env.TRIGGER_SECRET_KEY.trim();
    console.log(`\nTesting Trigger.dev Key: ${triggerKey.substring(0, 10)}...`);
    // Simple authentication check for Trigger.dev v3 API
    // The endpoint to check environment or whoami might vary, but a basic authenticated call to list runs usually works.
    const triggerRes = await axios.get('https://api.trigger.dev/api/v1/runs', {
      headers: {
        'Authorization': `Bearer ${triggerKey}`
      }
    });
    console.log('✅ Trigger.dev Key is VALID! (Status: ' + triggerRes.status + ')');
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('❌ Trigger.dev Key is INVALID (Unauthorized).');
    } else if (err.response) {
      console.log('✅ Trigger.dev Key seems valid (Auth passed), but got another error: ' + err.response.status);
    } else {
      console.log('❌ Trigger.dev Check Failed: ' + err.message);
    }
  }

  // 2. Verify Skyvern
  try {
    const skyvernKey = process.env.SKYVERN_API_KEY.trim();
    console.log(`\nTesting Skyvern Key: ${skyvernKey.substring(0, 15)}...`);
    const skyvernRes = await axios.get('https://api.skyvern.com/api/v1/organizations/me', {
      headers: {
        'x-api-key': skyvernKey
      }
    });
    console.log('✅ Skyvern Key is VALID! (Status: ' + skyvernRes.status + ')');
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log('❌ Skyvern Key is INVALID (Unauthorized).');
    } else if (err.response) {
       console.log('✅ Skyvern Key seems valid (Auth passed), but got another error: ' + err.response.status);
    } else {
      console.log('❌ Skyvern Check Failed: ' + err.message);
    }
  }
}

verifyKeys();
