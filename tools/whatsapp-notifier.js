/**
 * ============================================================
 * TOOL 4: WhatsApp Notifier — Twilio Integration
 * ============================================================
 * Sends real WhatsApp messages. JAW DROP moment during demo:
 * Judge's phone buzzes with real WhatsApp. Wins the room.
 * 
 * Input:  { to: string (phone), message: string }
 * Output: { status, sid, message }
 * 
 * Setup: twilio.com → free trial → sandbox WhatsApp number
 * ============================================================
 */

async function sendWhatsApp({ to, message }) {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Ensure phone number has WhatsApp prefix
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber
    });

    return {
      success: true,
      status: 'sent',
      sid: result.sid,
      to: toNumber,
      message: `WhatsApp sent to ${to}`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[WhatsApp] Failed: ${error.message}`);
    return {
      success: false,
      status: 'error',
      to,
      error: error.message,
      message: `Failed to send WhatsApp: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Send a formatted notification (with emoji + structure)
async function sendWhatsAppNotification({ to, title, body, urgency = 'normal' }) {
  const emoji = urgency === 'high' ? '🚨' : urgency === 'low' ? '📋' : '🤖';
  const formattedMessage = `${emoji} *${title}*\n\n${body}\n\n_— Agent Zero_`;
  return await sendWhatsApp({ to, message: formattedMessage });
}

module.exports = { sendWhatsApp, sendWhatsAppNotification };
