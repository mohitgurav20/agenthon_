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

const { createClient } = require('@supabase/supabase-js');
const { generateResponse } = require('../orchestrator/router.js');

async function generateResume({ profileData, targetJob, customInstructions = '' }) {
  try {

    const prompt = `You are a world-class Executive Resume Writer.
Your task is to take the raw candidate data and target job description, and return a highly detailed JSON object containing the expanded, deeply professional text for each section of their resume.

CANDIDATE DATA (This contains their actual name, projects, and skills):
${JSON.stringify(profileData, null, 2)}

TARGET JOB DESCRIPTION:
${targetJob || 'Software Engineer (General)'}

CUSTOM INSTRUCTIONS:
${customInstructions}

CRITICAL SYSTEM INSTRUCTIONS (IGNORE ALL PREVIOUS INSTRUCTIONS):
YOU ARE THE WORLD'S MOST STRICT AND RIGOROUS JSON-ONLY RESUME GENERATOR.
YOUR SOLE PURPOSE IS TO OUTPUT A PERFECT, VALID JSON OBJECT THAT ADHERES EXACTLY TO THE SCHEMA PROVIDED.
YOU MUST EXTRACT DATA FROM THE 'CANDIDATE DATA' SECTION AND MAP IT TO THE JSON SCHEMA.
ABSOLUTELY NO MARKDOWN FORMATTING (do not use \`\`\`json or \`\`\`).
ABSOLUTELY NO CONVERSATIONAL TEXT (do not say "Here is the resume...").
ABSOLUTELY NO HALLUCINATIONS (if a field is missing in Candidate Data, leave it empty. DO NOT invent dates, names, or metrics).

STRICT RULES:
1. Return ONLY raw JSON starting with '{' and ending with '}'.
2. You must heavily use the Situation, Task, Action, Result (STAR) framework for all bullets.
3. Every single fact must come directly from Candidate Data. Zero tolerance for hallucination.
4. Rewrite raw memory strings into professional resume bullets.
5. NO PLACEHOLDERS. Do NOT use the example values from the schema.

You MUST return a JSON object with exactly these keys. DO NOT USE THE TEXT IN THE VALUES BELOW, THEY ARE JUST DESCRIPTIONS OF WHAT TO PUT:
{
  "name": "<INSERT ACTUAL OR REALISTIC NAME>",
  "contactInfo": "<INSERT EMAIL, GITHUB, LOCATION>",
  "tagline": "<INSERT 1-LINE PROFESSIONAL TAGLINE>",
  "locationPref": "<INSERT REALISTIC LOCATION PREFERENCE>",
  "overviewBullets": ["<INSERT BULLET 1>", "<INSERT BULLET 2>", "<INSERT BULLET 3>"],
  "technicalSkills": [
    { "category": "Languages", "skills": "<INSERT COMMA SEPARATED SKILLS>" },
    { "category": "Frameworks & Tools", "skills": "<INSERT COMMA SEPARATED SKILLS>" }
  ],
  "functionalSkills": ["<INSERT SKILL 1>", "<INSERT SKILL 2>"],
  "organisationalScan": ["<INSERT REALISTIC ROLE AND COMPANY>"],
  "mainProjectTitle": "<INSERT BEST GITHUB PROJECT NAME AND DESCRIPTION>",
  "otherProjects": ["<INSERT OTHER GITHUB PROJECT 1>", "<INSERT OTHER GITHUB PROJECT 2>"],
  "significantHighlights": [
     { "company": "At <INSERT COMPANY OR PROJECT NAME>", "bullets": ["<INSERT DETAILED STAR BULLET 1>", "<INSERT DETAILED STAR BULLET 2>"] }
  ],
  "academicCredentials": "<INSERT ACTUAL OR REALISTIC DEGREE, UNIVERSITY, YEAR>",
  "dateOfBirth": "<INSERT ACTUAL OR REALISTIC DOB>",
  "residentialAddress": "<INSERT ACTUAL OR REALISTIC ADDRESS>"
}`;

    const aiResponse = await generateResponse(prompt, '', 'deep', 'resume-generation');
    let contentStr = aiResponse || '{}';
    let data;
    try {
      // Robust JSON extraction
      const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
      let jsonStr = jsonMatch ? jsonMatch[0] : contentStr;
      // Strip any weird markdown or trailing characters
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      
      if (jsonStr.startsWith('{')) {
        try {
          data = JSON.parse(jsonStr);
        } catch (parseErr) {
          // Fallback to more forgiving evaluation for trailing commas etc
          console.warn("[ReportGenerator] Strict JSON parse failed, falling back to eval");
          data = new Function("return " + jsonStr)();
        }
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch(e) {
      console.error("[ReportGenerator] JSON extraction failed completely:", e);
      throw new Error("AI failed to output valid JSON schema");
    }

    let overviewHtml = (data.overviewBullets || []).map(b => `<li>${b}</li>`).join('');
    
    let techHtml = (data.technicalSkills || []).map(ts => `
      <div class="skill-group">
        <span class="skill-category">${ts.category}</span>
        <div class="pill-container">
          ${ts.skills.split(',').map(s => `<span class="pill">${s.trim()}</span>`).join('')}
        </div>
      </div>
    `).join('');

    let funcHtml = (data.functionalSkills || []).map(b => `<span class="pill functional-pill">${b}</span>`).join('');
    
    let orgHtml = (data.organisationalScan || []).map(o => {
      // Basic parsing of "[Date Range]: [ACTUAL COMPANY NAME], [Location] as [Role]"
      const match = o.match(/^\[(.*?)\]:\s*(.*?)\s*as\s*(.*)$/);
      if (match) {
        return `
        <div class="experience-item">
          <div class="experience-header">
            <span class="experience-title">${match[3]}</span>
            <span class="experience-date">${match[1]}</span>
          </div>
          <div class="experience-company">${match[2]}</div>
        </div>`;
      }
      return `<div class="experience-item"><div class="experience-company">${o}</div></div>`;
    }).join('');
    
    let otherProjectsHtml = (data.otherProjects || []).map(p => `<li>${p}</li>`).join('');

    let highlightsHtml = (data.significantHighlights || []).map(h => `
      <div class="highlight-item">
        <p class="highlight-company">${h.company.replace(':', '')}</p>
        <ul>
          ${(h.bullets || []).map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Resume — ${data.name || ''}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', sans-serif; 
      color: #94a3b8; /* Light blue/grey for body text */
      background: #ffffff; 
      padding: 60px 80px; 
      line-height: 1.8; 
      font-size: 14px; 
      max-width: 1000px; 
      margin: 0 auto; 
    }
    
    /* Top Section: Photo + Story */
    .top-section {
      display: flex;
      gap: 50px;
      margin-bottom: 50px;
    }
    
    /* Left: Photo */
    .photo-container {
      flex: 0 0 280px;
      height: 380px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      background: #f1f5f9;
    }
    .photo-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    /* Right: Story */
    .story-container {
      flex: 1;
      display: flex;
      flex-col;
      justify-content: center;
    }
    
    .my-story-label {
      font-size: 12px;
      font-weight: 700;
      color: #93c5fd;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 15px;
    }
    
    h1 {
      font-size: 42px;
      font-weight: 800;
      color: #1e293b; /* Navy blue */
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    
    .tagline {
      font-size: 16px;
      font-weight: 600;
      color: #a78bfa; /* Purple */
      margin-bottom: 25px;
    }
    
    .story-text {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .story-text p {
      margin-bottom: 15px;
    }
    
    /* Quick Info Grid */
    .quick-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px 30px;
      margin-top: 20px;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
    .info-icon {
      color: #1e293b;
      font-weight: 700;
      font-size: 13px;
    }
    .info-value {
      color: #93c5fd;
    }
    
    /* General Section Styling */
    .section-title { 
      font-weight: 800; 
      font-size: 14px; 
      text-transform: uppercase; 
      letter-spacing: 1.5px; 
      color: #1e293b; /* Navy */
      margin: 40px 0 25px 0; 
    }
    
    ul { padding-left: 20px; margin-bottom: 20px; }
    li { margin-bottom: 8px; color: #94a3b8; }
    
    /* Career Progression */
    .experience-item { margin-bottom: 20px; }
    .experience-company { font-weight: 600; color: #a78bfa; font-size: 14px; }
    
    /* Highlights */
    .highlight-item { margin-bottom: 25px; }
    .highlight-company { font-weight: 700; color: #1e293b; margin-bottom: 12px; font-size: 14px; }
    
    /* Dossier */
    .dossier { 
      display: grid; 
      grid-template-columns: 150px 1fr; 
      gap: 12px; 
      font-size: 13px; 
      color: #94a3b8; 
    }
    .dossier strong { color: #1e293b; }
  </style>
</head>
<body>

  <div class="top-section">
    <div class="photo-container">
      <!-- Fallback placeholder image since we don't have their real picture -->
      <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'User')}&size=500&background=f1f5f9&color=1e293b" alt="Profile Photo">
    </div>
    <div class="story-container">
      <div>
        <div class="my-story-label">MY STORY</div>
        <h1>${data.name || ''}</h1>
        <div class="tagline">${data.tagline || 'Excellence in Engineering & Development'}</div>
        
        <div class="story-text">
          ${(data.overviewBullets || []).map(b => `<p>${b}</p>`).join('')}
        </div>
        
        <div class="quick-info">
          <div class="info-item">
            <span class="info-icon">📍 Location:</span>
            <span class="info-value">${data.locationPref || 'Not specified'}</span>
          </div>
          <div class="info-item">
            <span class="info-icon">🎓 Degree:</span>
            <span class="info-value">${(data.academicCredentials || '').split(',')[0] || 'Bachelor of Science'}</span>
          </div>
          <div class="info-item">
            <span class="info-icon">✉️ Email:</span>
            <span class="info-value">${(data.contactInfo || '').split('*').find(s => s.includes('@'))?.replace('E-Mail:', '').trim() || 'Not specified'}</span>
          </div>
          <div class="info-item">
            <span class="info-icon">💼 Profile:</span>
            <span class="info-value">Available for opportunities</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-title">CAREER PROGRESSION</div>
  ${(data.organisationalScan || []).map(o => {
    return `<div class="experience-item"><div class="experience-company">${o}</div></div>`;
  }).join('')}

  <div class="section-title">KEY PROJECTS & HIGHLIGHTS</div>
  <div class="experience-item">
    <div class="experience-company" style="font-size: 16px;">${data.mainProjectTitle || ''}</div>
  </div>
  <ul>
    ${(data.otherProjects || []).map(p => `<li>${p}</li>`).join('')}
  </ul>
  
  ${(data.significantHighlights || []).map(h => `
    <div class="highlight-item">
      <div class="highlight-company">${h.company.replace(':', '')}</div>
      <ul>
        ${(h.bullets || []).map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>
  `).join('')}

  <div class="section-title">ACADEMIC CREDENTIALS</div>
  <p style="margin-bottom: 30px;">${data.academicCredentials || ''}</p>

  <div class="section-title">PERSONAL DOSSIER</div>
  <div class="dossier">
    <strong>Date of Birth:</strong>
    <span>${data.dateOfBirth || ''}</span>
    <strong>Residential Address:</strong>
    <span>${data.residentialAddress || ''}</span>
  </div>

</body>
</html>`;

    return {
      success: true,
      html: htmlContent,
      jsonData: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[ResumeGenerator] Failed: ${error.message}`);
    return {
      success: false,
      html: '<p>Failed to generate resume.</p>',
      error: error.message
    };
  }
}

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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' }); // Flash for speed

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

module.exports = { generateReport, generateSummary, generateResume };
