/**
 * ============================================================
 * TOOL 9: Data Analytics
 * ============================================================
 * Agent queries Supabase → calculates trends, averages, 
 * correlations → formats as chart-ready JSON.
 * 
 * Input:  { table: string, query?: object, analysisType: string }
 * Output: { summary: string, chartData: object, confidence }
 * ============================================================
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Fetch data from Supabase and analyze it
async function analyzeData({ table, query = {}, analysisType = 'trend', maxRows = 1000 }) {
  try {
    const supabase = getSupabase();
    
    // Build query
    let sbQuery = supabase.from(table).select('*').limit(maxRows);
    
    // Apply basic filters if provided (key-value equality)
    if (query && typeof query === 'object') {
      Object.keys(query).forEach(key => {
        sbQuery = sbQuery.eq(key, query[key]);
      });
    }

    // Fetch data
    const { data, error } = await sbQuery;
    
    if (error) throw error;
    if (!data || data.length === 0) {
      return { success: true, summary: 'No data found for the given query.', chartData: null, rowsAnalyzed: 0 };
    }

    // Use Gemini to perform complex statistical analysis and generate chart data
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' }); // Need reasoning power

    const prompt = `You are a Senior Data Analyst. Analyze the following dataset (max 1000 rows).
Dataset from table '${table}':
${JSON.stringify(data.slice(0, 50))} ${data.length > 50 ? `... (+${data.length - 50} more rows)` : ''}

Analysis Request: ${analysisType}

Your task:
1. Identify the key numerical and categorical columns relevant to the request.
2. Calculate key metrics (averages, totals, correlations, anomalies).
3. Generate a strict JSON object representing 'chartData' suitable for Recharts or Chart.js.
   - It should have an array of objects. Example: [{ "name": "Jan", "value": 400 }, ...]
4. Provide a brief text summary of the insights.

Return EXACTLY this JSON structure, nothing else:
{
  "summary": "Brief 2-3 sentence summary of findings.",
  "chartData": [ ... array of objects ... ],
  "confidenceScore": 95
}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // Clean up potential markdown formatting from LLM response
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('[DataAnalytics] Failed to parse LLM JSON output, returning raw text.');
      analysisResult = { summary: responseText, chartData: null, confidenceScore: 50 };
    }

    return {
      success: true,
      table,
      analysisType,
      rowsAnalyzed: data.length,
      summary: analysisResult.summary,
      chartData: analysisResult.chartData,
      confidence: analysisResult.confidenceScore,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[DataAnalytics] Failed: ${error.message}`);
    return {
      success: false,
      table,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { analyzeData };
