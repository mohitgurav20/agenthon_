require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  console.log("Fetching available Gemini models for your API key...");
  try {
    // The SDK might not have a direct listModels wrapper exposed in older versions, 
    // so we will fetch it directly using fetch API to guarantee it works.
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log("✅ Models found. Here are the text generation models you can use:");
      data.models.forEach(m => {
        if (m.supportedGenerationMethods.includes("generateContent")) {
          console.log(`- ${m.name.replace('models/', '')} (${m.description.substring(0, 50)}...)`);
        }
      });
    } else {
      console.log("❌ Error fetching models:", data);
    }
  } catch (error) {
    console.log("❌ Fatal Error:", error.message);
  }
}

listModels();
