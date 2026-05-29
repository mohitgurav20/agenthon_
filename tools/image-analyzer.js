/**
 * ============================================================
 * TOOL 6: Image Analyzer — Gemini Vision (Multimodal)
 * ============================================================
 * Gemini 1.5 Pro is natively multimodal. No extra setup.
 * Most agents are text-only — yours handles vision.
 * 
 * Input:  { imagePath: string, question?: string }
 * Output: { analysis: string, confidence: number }
 * ============================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

async function analyzeImage(imagePath, question = 'Analyze this image in detail. Describe what you see, extract any text, and provide key insights.') {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' }); // Vision requires specific model in some SDK versions

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine MIME type
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png', '.gif': 'image/gif',
      '.webp': 'image/webp', '.bmp': 'image/bmp'
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType
      }
    };

    const result = await model.generateContent([question, imagePart]);
    const response = result.response;
    const analysis = response.text();

    return {
      success: true,
      analysis,
      question,
      imagePath,
      mimeType,
      confidence: 0.85, // Gemini Vision is reliable
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[ImageAnalyzer] Failed: ${error.message}`);
    return {
      success: false,
      analysis: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Analyze image from URL (downloads first)
async function analyzeImageFromURL(imageUrl, question) {
  try {
    const axios = require('axios');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
    
    // Save temporarily
    const tempPath = path.join(__dirname, '..', 'uploads', `temp_${Date.now()}.jpg`);
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    fs.writeFileSync(tempPath, response.data);
    
    const result = await analyzeImage(tempPath, question);
    
    // Cleanup
    try { fs.unlinkSync(tempPath); } catch (e) {}
    
    return result;

  } catch (error) {
    return {
      success: false,
      analysis: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Analyze chart/graph specifically
async function analyzeChart(imagePath) {
  return await analyzeImage(imagePath, 
    'This is a chart or graph. Please: 1) Identify the type of chart, 2) List all data points and values, 3) Describe the trend, 4) Provide key insights and conclusions. Return structured analysis.'
  );
}

module.exports = { analyzeImage, analyzeImageFromURL, analyzeChart };
