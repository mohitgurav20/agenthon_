/**
 * ============================================================
 * TOOL 7: Report Generator
 * ============================================================
 * Takes Supabase data → structures into professional report:
 * Executive Summary + Key Findings + Recommendations + Actions.
 * Judges get professional deliverable, not just chat output.
 * 
 * Input:  { data: object, topic: string, format?: string }
 * Output: { report: string, sections: object, format }
 * ============================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

async function generateReport({ data, topic, format = 'markdown', customSections = null }) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const sections = customSections || [
      'Executive Summary',
      'Key Findings',
      'Data Analysis',
      'Recommendations',
      'Action Items',
      'Conclusion'
    ];

    const prompt = `You are a professional report writer for an AI agent system called Agent Zero.

Generate a comprehensive, well-structured report on the topic: "${topic}"

Based on this data:
${JSON.stringify(data, null, 2)}

Structure the report with these sections:
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Requirements:
- Be data-driven — reference specific numbers, dates, and facts from the data
- Executive Summary should be 2-3 sentences max
- Key Findings should be bullet points with evidence
- Recommendations should be actionable and specific
- Use ${format === 'markdown' ? 'Markdown formatting with headers, bullets, and bold text' : 'plain text formatting'}
- Include a confidence score (0-100) for each finding
- End with a clear "Next Steps" list

Return ONLY the report content, no meta-commentary.`;

    const result = await model.generateContent(prompt);
    const reportContent = result.response.text();

    // Store report in Supabase
    const reportRecord = {
      topic,
      content: reportContent,
      format,
      data_snapshot: data,
      generated_at: new Date().toISOString()
    };

    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('agent_outputs').insert({
        agent_name: 'report-generator',
        input: JSON.stringify({ topic, format }),
        output: reportContent,
        confidence: 0.9,
        tools_used: ['gemini-1.5-pro', 'supabase'],
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      console.warn(`[ReportGenerator] DB storage skipped: ${dbError.message}`);
    }

    return {
      success: true,
      topic,
      report: reportContent,
      format,
      wordCount: reportContent.split(/\s+/).length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[ReportGenerator] Failed: ${error.message}`);
    return {
      success: false,
      topic,
      report: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Quick summary (shorter, for inline use)
async function generateSummary(data, maxSentences = 3) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Flash for speed

    const prompt = `Summarize the following data in exactly ${maxSentences} sentences. Be specific and data-driven:\n\n${JSON.stringify(data, null, 2)}`;
    
    const result = await model.generateContent(prompt);
    
    return {
      success: true,
      summary: result.response.text(),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      summary: '',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { generateReport, generateSummary };
