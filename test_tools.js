require('dotenv').config();
const tools = require('./tools');

async function runTests() {
  console.log("🚀 Starting Tool Tests with REAL API Keys...\n");

  // 1. Test Email Tool
  console.log("--- 1. Testing Email Sender ---");
  const emailResult = await tools.executeTool('send_email', {
    to: 'chinmayr540@gmail.com',
    subject: 'Agent Zero - Hackathon Prep Test',
    body: 'This is a test email from the Agent Zero backend to verify your Nodemailer configuration is fully operational for the hackathon!'
  });
  console.log(emailResult);
  console.log("\n");

  // 2. Test WhatsApp Tool
  console.log("--- 2. Testing WhatsApp Notifier ---");
  const waResult = await tools.executeTool('send_whatsapp', {
    to: 'whatsapp:+918792177479', // Replaced space with valid formatting
    message: 'Your Twilio verification code is 123456'
  });
  console.log(waResult);
  console.log("\n");

  // 3. Test Gemini Analytics Tool
  console.log("--- 3. Testing Gemini Pro Data Analytics ---");
  // We'll mock the Supabase data part by providing raw data to analyze, 
  // bypassing the actual DB fetch just to test the LLM connection
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    const result = await model.generateContent("Respond with exactly: 'Gemini Pro API Key is active and ready for data analysis.'");
    console.log({
      success: true,
      message: result.response.text().trim(),
      toolName: 'gemini_pro_test'
    });
  } catch (error) {
    console.log({
      success: false,
      error: error.message,
      toolName: 'gemini_pro_test'
    });
  }
  
  console.log("\n✅ All tests complete.");
}

runTests();
