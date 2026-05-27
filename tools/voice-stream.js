/**
 * ============================================================
 * TOOL 13: Voice Stream Manager (Interruptible ElevenLabs)
 * ============================================================
 * Creates a WebSocket server that receives user audio chunks,
 * streams them to an LLM/STT, and streams ElevenLabs audio back.
 * If the user interrupts, it sends a 'clear' signal.
 * ============================================================
 */

const { WebSocketServer } = require('ws');
const { executeTool } = require('./index');

function setupVoiceStream(server) {
  // Mount WebSocket server on top of existing HTTP server
  const wss = new WebSocketServer({ server, path: '/api/voice-stream' });

  wss.on('connection', (ws) => {
    console.log('[VoiceStream] New client connected for bi-directional audio');
    let isAgentSpeaking = false;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle User Interrupt
        if (data.type === 'interrupt') {
          console.log('[VoiceStream] User interrupted the agent!');
          isAgentSpeaking = false;
          // In a full implementation, we would abort the ElevenLabs stream here.
          ws.send(JSON.stringify({ type: 'status', message: 'Agent interrupted' }));
          return;
        }

        // Handle Text Input (Simulating VAD / STT completion for hackathon)
        if (data.type === 'text') {
          console.log(`[VoiceStream] User said: ${data.text}`);
          isAgentSpeaking = true;

          // For the hackathon, we simulate generating a response and streaming it via ElevenLabs TTS
          // using our existing TTS tool, but in a real stream we'd pipe the raw binary audio buffer over WS.
          ws.send(JSON.stringify({ type: 'status', message: 'Agent is thinking...' }));
          
          const ttsResult = await executeTool('text_to_speech', { 
            text: `I heard you say: ${data.text}. This is a simulated stream response.`,
            voiceId: '21m00Tcm4TlvDq8ikWAM'
          });

          if (isAgentSpeaking && ttsResult.success) {
            // Send the base64 audio back to the client
            ws.send(JSON.stringify({ 
              type: 'audio', 
              audioBuffer: ttsResult.result.audioBase64 
            }));
            isAgentSpeaking = false;
          }
        }
      } catch (error) {
        console.error('[VoiceStream] Error processing message:', error.message);
      }
    });

    ws.on('close', () => {
      console.log('[VoiceStream] Client disconnected');
    });
  });

  console.log('🎙️ Voice Stream WebSocket mounted on /api/voice-stream');
}

module.exports = { setupVoiceStream };
