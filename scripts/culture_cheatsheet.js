require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchHybridWithScoring } = require('./rag_pipeline');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

/**
 * ⚡ AGENT ZERO - RECRUITER CULTURE CHEAT-SHEET GENERATOR
 * 
 * Matches a target company's job description and values against the candidate's
 * vectorized project history to generate a tailored interview cheat-sheet.
 * 
 * @param {string} companyName - Target company
 * @param {string} jobDescription - Full text of the target job
 * @returns {Promise<Object>} The generated culture fit card
 */
async function generateCultureCard(companyName, jobDescription) {
    if (!companyName || !jobDescription) {
        throw new Error("Missing companyName or jobDescription");
    }

    console.log(`\n📋 [CultureCard] Compiling cheat-sheet for ${companyName}...`);

    // 1. Extract core values from the job description using Gemini
    const extractModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const extractPrompt = `
You are an expert HR recruiter. Analyze the following job description for ${companyName} and extract the top 3 core corporate values or cultural traits they are looking for.
Return ONLY a JSON array of strings, nothing else. Example: ["Fast-paced", "Data-driven", "Collaborative"]

Job Description:
${jobDescription}
`;
    
    let cultureValues = [];
    try {
        const extractResult = await extractModel.generateContent(extractPrompt);
        let text = extractResult.response.text().trim();
        // Clean up markdown block if present
        if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        if (text.startsWith('```')) text = text.replace(/```/g, '').trim();
        cultureValues = JSON.parse(text);
        console.log(`[CultureCard] Extracted values:`, cultureValues);
    } catch (e) {
        console.warn(`[CultureCard] Failed to extract values, defaulting. Error:`, e.message);
        cultureValues = ["Innovative", "Results-oriented", "Team-player"]; // fallback
    }

    // 2. Perform Hybrid Search to find matching candidate projects
    const searchQuery = `${companyName} culture: ${cultureValues.join(', ')}. ${jobDescription.substring(0, 200)}`;
    console.log(`[CultureCard] Searching candidate vector database for matches...`);
    // Using our new hybrid search pipeline from Task 1
    const ragResults = await searchHybridWithScoring(searchQuery, { matchCount: 3, matchThreshold: 0.1 });

    const matchedProjects = (ragResults || []).map(r => ({
        content: r.content,
        similarity: r.similarity,
        rrf_score: r.rrf_score
    }));

    // 3. Generate the final cheat sheet
    const cheatSheetModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
    const cheatSheetPrompt = `
You are a career coach preparing a candidate for an interview at ${companyName}.
Using the extracted company culture values and the candidate's matching projects from our database, generate a concise "Culture Fit Cheat-Sheet".

Company: ${companyName}
Culture Values: ${cultureValues.join(', ')}

Candidate's Relevant Projects/Experience (from vector database):
${matchedProjects.length > 0 
    ? matchedProjects.map((p, i) => `--- Project ${i+1} ---\n${p.content}`).join('\n\n') 
    : "No highly relevant projects found. Focus on general transferable skills."}

Generate a JSON object with the following schema (NO markdown formatting, just raw JSON):
{
    "companyName": "${companyName}",
    "cultureValues": ["val1", "val2"],
    "fitScore": <number 1-100 based on how well the projects match the values>,
    "cheatSheet": {
        "strengths": ["point 1", "point 2"],
        "talkingPoints": ["point 1", "point 2"],
        "potentialGaps": ["point 1", "point 2"]
    }
}
`;

    let finalCard = null;
    try {
        const result = await cheatSheetModel.generateContent(cheatSheetPrompt);
        let text = result.response.text().trim();
        
        // Robust JSON substring extraction
        const firstBracket = text.indexOf('{');
        const lastBracket = text.lastIndexOf('}');
        if (firstBracket !== -1 && lastBracket !== -1) {
            text = text.substring(firstBracket, lastBracket + 1);
        } else {
            if (text.startsWith('```json')) text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            if (text.startsWith('```')) text = text.replace(/```/g, '').trim();
        }

        finalCard = JSON.parse(text);
        finalCard.matchedProjects = matchedProjects;
        console.log(`[CultureCard] ✅ Successfully generated culture card with fit score: ${finalCard.fitScore}`);
    } catch (e) {
        console.error(`[CultureCard] Error generating final card:`, e.message);
        throw new Error("Failed to generate culture cheat-sheet.");
    }

    return finalCard;
}

// Allow CLI execution for testing
if (require.main === module) {
    const testCompany = "Acme Corp";
    const testDesc = "We are looking for a fast-paced, highly collaborative software engineer who thrives on data-driven decision making and rapid prototyping. Must be able to work well in cross-functional teams.";
    
    generateCultureCard(testCompany, testDesc)
        .then(res => console.log("\nFINAL CARD:\n", JSON.stringify(res, null, 2)))
        .catch(console.error);
}

module.exports = { generateCultureCard };
