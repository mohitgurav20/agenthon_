/**
 * ============================================================
 * TOOL 8: Real Phone Call — Bland AI
 * ============================================================
 * NUCLEAR OPTION. Agent calls real phone number during demo,
 * speaks naturally, handles conversation, reports back.
 * Save for climax of demo.
 * 
 * Input:  { phoneNumber, task, voice?, firstSentence? }
 * Output: { callId, status, transcript?, duration? }
 * 
 * Setup: bland.ai → trial credits
 * ============================================================
 */

const axios = require('axios');

const BLAND_API_URL = 'https://api.bland.ai/v1/calls';

async function makePhoneCall({ phoneNumber, task, voice = 'mason', firstSentence = null, maxDuration = 120 }) {
  try {
    if (!process.env.BLAND_API_KEY) {
      throw new Error('BLAND_API_KEY not configured. Get trial credits at bland.ai');
    }

    const callPayload = {
      phone_number: phoneNumber,
      task,
      voice,
      first_sentence: firstSentence || `Hello! I'm calling from Agent Zero, an AI assistant.`,
      max_duration: maxDuration,
      wait_for_greeting: true,
      record: true,
      model: 'enhanced',
      language: 'en'
    };

    const response = await axios.post(BLAND_API_URL, callPayload, {
      headers: {
        'Authorization': process.env.BLAND_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return {
      success: true,
      status: 'call_initiated',
      callId: response.data.call_id,
      phoneNumber,
      task,
      message: `Phone call initiated to ${phoneNumber}`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[PhoneCaller] Failed: ${error.message}`);
    return {
      success: false,
      status: 'error',
      phoneNumber,
      error: error.message,
      message: `Failed to initiate call: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check call status + get transcript
async function getCallStatus(callId) {
  try {
    const response = await axios.get(`${BLAND_API_URL}/${callId}`, {
      headers: {
        'Authorization': process.env.BLAND_API_KEY
      },
      timeout: 10000
    });

    const data = response.data;

    return {
      success: true,
      callId,
      status: data.status,
      duration: data.call_length,
      transcript: data.transcripts || [],
      summary: data.summary || '',
      recording_url: data.recording_url || null,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      callId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { makePhoneCall, getCallStatus };
