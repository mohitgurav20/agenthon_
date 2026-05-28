/**
 * ============================================================
 * TOOL 3: Email Sender — Gmail via Nodemailer
 * ============================================================
 * Sends real emails. Demo: agent writes AND sends professional
 * email live. Judges' real inboxes get real emails.
 * 
 * Input:  { to, subject, body, html? }
 * Output: { status, messageId, message }
 * 
 * Setup: Gmail → Settings → App Passwords → generate one.
 * ============================================================
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, body, html = null }) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
    }

    const mailOptions = {
      from: `Agent Zero <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: body,
      ...(html && { html })
    };

    const info = await getTransporter().sendMail(mailOptions);

    return {
      success: true,
      status: 'sent',
      messageId: info.messageId,
      to,
      subject,
      message: `Email sent successfully to ${to}`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[EmailSender] Failed: ${error.message}`);
    return {
      success: false,
      status: 'error',
      to,
      subject,
      error: error.message,
      message: `Failed to send email: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Generate professional HTML email template
function generateEmailHTML({ title, greeting, bodyText, actionUrl, actionLabel, footer }) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d14; color: #e2e8f0; border-radius: 16px; overflow: hidden; border: 1px solid #252540;">
      <div style="background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; color: #fff;">${title || 'Agent Zero'}</h1>
      </div>
      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #a78bfa; margin-bottom: 8px;">${greeting || 'Hello,'}</p>
        <p style="font-size: 14px; line-height: 1.6; color: #e2e8f0;">${bodyText}</p>
        ${actionUrl ? `
          <div style="text-align: center; margin: 24px 0;">
            <a href="${actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">${actionLabel || 'Take Action'}</a>
          </div>
        ` : ''}
      </div>
      <div style="padding: 16px 24px; border-top: 1px solid #252540; text-align: center;">
        <p style="font-size: 11px; color: #4a5568;">${footer || 'Sent by Agent Zero — Agentic AI Hackathon 2026'}</p>
      </div>
    </div>
  `;
}

// Direct Apply function with Resume Attachment
async function sendDirectApplication({ to, jobTitle, resumePdfPath, recruiterName = "Hiring Manager", userName = "Candidate" }) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not configured.');
    }

    const subject = `Application for ${jobTitle} - ${userName}`;
    const bodyText = `Dear ${recruiterName},\n\nI am writing to express my strong interest in the ${jobTitle} position. Please find my tailored resume attached.\n\nBest regards,\n${userName}\n(Sent via Agent Zero Autonomous Apply)`;
    
    // Convert to HTML
    const htmlBody = bodyText.replace(/\n/g, '<br>');

    const mailOptions = {
      from: `${userName} (via Agent Zero) <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: bodyText,
      html: htmlBody,
      attachments: [
        {
          filename: `Resume_${userName.replace(' ', '_')}.pdf`,
          path: resumePdfPath // Nodemailer handles reading the file path directly
        }
      ]
    };

    console.log(`[EmailSender] Sending direct application to ${to} with attachment ${resumePdfPath}`);
    const info = await getTransporter().sendMail(mailOptions);

    return {
      success: true,
      status: 'sent',
      messageId: info.messageId,
      message: `Application emailed successfully to ${to} with resume attached.`
    };
  } catch (error) {
    console.error(`[EmailSender] Application send failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail, generateEmailHTML, sendDirectApplication };
