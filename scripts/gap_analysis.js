require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchWithFallbackChain } = require('./rag_pipeline');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

/**
 * ⚡ AGENT ZERO - SEMANTIC GAP ANALYSIS
 * 
 * Compares a target job description against a candidate's RAG profile
 * to identify missing technical skills and generates 10-minute micro-learning cards.
 * 
 * @param {string} jobDescription - Target job requirements
 * @param {string} candidateId - (Optional) To filter RAG if needed
 * @returns {Promise<Object>} Gap analysis report and micro-learning cards
 */
async function generateGapAnalysis(jobDescription, candidateId = null) {
    if (!jobDescription) throw new Error("Missing jobDescription");

    console.log(`\n🔍 [GapAnalysis] Analyzing job description for semantic gaps...`);

    // 1. Extract required hard skills from the job description
    const extractModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const extractPrompt = `
Analyze the following job description and extract a definitive list of hard technical skills, tools, frameworks, and specific domain knowledge required.
Return ONLY a JSON array of strings. Example: ["React", "Node.js", "Docker", "AWS", "PostgreSQL", "Redis"]

Job Description:
${jobDescription}
`;

    let requiredSkills = [];
    try {
        const extractResult = await extractModel.generateContent(extractPrompt);
        let text = extractResult.response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        if (text.startsWith('```')) text = text.replace(/```/g, '').trim();
        requiredSkills = JSON.parse(text);
        console.log(`[GapAnalysis] Job requires: ${requiredSkills.join(', ')}`);
    } catch (e) {
        console.warn(`[GapAnalysis] Failed to extract skills cleanly, falling back to basic extraction. Error:`, e.message);
        requiredSkills = ["JavaScript", "Python", "SQL", "Docker"];
    }

    // 2. Query candidate's RAG profile for these exact skills to see what they have
    // We use fallback chain to ensure we get some context even if hybrid isn't deployed yet
    console.log(`[GapAnalysis] Searching candidate vector DB for evidence of required skills...`);
    const ragQuery = `Evidence of skills: ${requiredSkills.join(', ')}`;
    const { results: ragResults } = await searchWithFallbackChain(ragQuery, 5);

    const candidateContext = ragResults.length > 0 
        ? ragResults.map((r, i) => `--- Profile Chunk ${i+1} ---\n${r.content}`).join('\n\n')
        : "No significant technical projects found in database.";

    // 3. Generate the Gap Analysis and Micro-Learning Cards
    const analysisModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const analysisPrompt = `
You are a technical career coach. Compare the Required Skills for a job against the Candidate's Profile Context.
Identify exactly which Required Skills are MISSING from the candidate's profile.
For up to 3 of the most critical missing skills, generate a "10-Minute Micro-Learning Card".

Required Skills:
${requiredSkills.join(', ')}

Candidate Profile Context:
${candidateContext}

Return a JSON object with this exact schema (NO markdown formatting, just raw JSON):
{
    "matchPercentage": <number 1-100 based on how many required skills the candidate has>,
    "presentSkills": ["skill1", "skill2"],
    "missingSkills": ["skill3", "skill4"],
    "microLearningCards": [
        {
            "skill": "skill3",
            "whyItMatters": "Why this skill is crucial for this specific role.",
            "tenMinuteActionPlan": "A highly specific, 10-minute crash-course task or concept to learn immediately.",
            "resourceQuery": "What to search on Google/YouTube to learn this fast"
        }
    ]
}
`;

    let gapReport = null;
    try {
        const result = await analysisModel.generateContent(analysisPrompt);
        let text = result.response.text().trim();
        if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        if (text.startsWith('```')) text = text.replace(/```/g, '').trim();
        
        gapReport = JSON.parse(text);
        console.log(`[GapAnalysis] ✅ Generated Gap Analysis! Match: ${gapReport.matchPercentage}%`);
        console.log(`[GapAnalysis] Missing: ${gapReport.missingSkills.join(', ')}`);
    } catch (e) {
        console.error(`[GapAnalysis] Error generating gap analysis:`, e.message);
        throw new Error("Failed to generate semantic gap analysis.");
    }

    return gapReport;
}

// Allow CLI execution for testing
if (require.main === module) {
    const testDesc = "We need a Senior Backend Engineer proficient in Node.js, PostgreSQL, Docker, Redis, and Kubernetes for scalable microservices deployment.";
    generateGapAnalysis(testDesc)
        .then(res => console.log("\nGAP REPORT:\n", JSON.stringify(res, null, 2)))
        .catch(console.error);
}

module.exports = { generateGapAnalysis };
