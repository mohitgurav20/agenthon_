/**
 * ============================================================
 * TOOL 10: Voice Interface (ElevenLabs TTS + Whisper)
 * ============================================================
 * Full voice loop. No keyboard needed during demo.
 * 
 * Input (TTS): { text: string, voiceId?: string }
 * Output (TTS): { audioUrl: string, status }
 * ============================================================
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Text-to-Speech using ElevenLabs
async function textToSpeech(text, voiceId = null) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

    const selectedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice (Rachel)
    const url = `${ELEVENLABS_API_URL}/${selectedVoiceId}`;

    const response = await axios.post(
      url,
      {
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Save audio file locally for demo purposes (in production, upload to S3/Supabase Storage)
    const fileName = `tts_${uuidv4()}.mp3`;
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, response.data);

    return {
      success: true,
      textPreview: text.substring(0, 50) + '...',
      filePath: filePath,
      // In a real app, this would be a public URL served by Express or Supabase Storage
      audioUrl: `/uploads/${fileName}`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[VoiceInterface] TTS Failed: ${error.message}`);
    return {
      success: false,
      error: error.response?.data?.detail?.message || error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Mock implementation of Whisper STT (Speech-to-Text)
// In a real hackathon, you'd call OpenAI's Whisper API endpoint here
async function speechToText(audioFilePath) {
  console.log(`[VoiceInterface] Transcribing audio from ${audioFilePath}...`);
  // Mock return
  return {
    success: true,
    text: "This is a mock transcription of the user's voice input.",
    confidence: 0.98,
    timestamp: new Date().toISOString()
  };
}

// Trigger a dynamic recruiter feedback voice alert
async function triggerRecruiterFeedback({ candidateName = "Candidate", jobTitle, status = "submitted" }) {
  let script = "";
  if (status === "submitted") {
    script = `Hello ${candidateName}. Great news! We have successfully submitted your application for the ${jobTitle} position. I'll let you know when they respond.`;
  } else if (status === "interview") {
    script = `Hi ${candidateName}! They loved your profile for the ${jobTitle} role and want to schedule an interview! Check your email for details.`;
  } else {
    script = `Hello ${candidateName}. Your application for ${jobTitle} has a new update. Please check your dashboard.`;
  }
  
  console.log(`[VoiceInterface] Generating recruiter feedback for status: ${status}`);
  return await textToSpeech(script);
}

module.exports = { textToSpeech, speechToText, triggerRecruiterFeedback };
