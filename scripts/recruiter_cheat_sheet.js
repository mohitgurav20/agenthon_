/**
 * ⚡ AGENT ZERO - DYNAMIC RAG RECRUITER "CHEAT-SHEET" GENERATOR
 * 
 * Matches candidate's stateful Mem0 milestones and Supabase pgvector guidelines 
 * against target company culture/JD, compiling a premium markdown Recruiter Cheat-Sheet.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { searchKnowledgeBase } = require('./rag_pipeline');
const { retrieveMemory } = require('./retrieve_memory');

/**
 * Generate a stunning Recruiter Cheat-Sheet for a company
 * @param {string} userId - User ID in Mem0
 * @param {string} companyName - Name of target company
 * @param {string} jobDescription - Target job requirements/description
 * @returns {Promise<object>} Status, markdown content, and filePath
 */
async function generateRecruiterCheatSheet(userId = 'agent-zero-user', companyName = 'Target Company', jobDescription = '') {
    console.log(`\n💎 [CheatSheetGen] Compiling recruiter cheat-sheet for ${companyName}...`);

    try {
        // 1. Retrieve user career milestones from Mem0
        let userMilestones = [];
        try {
            const retrieveRes = await retrieveMemory('skills, projects, certifications, experiences, achievements', userId);
            userMilestones = retrieveRes || [];
        } catch (e) {
            console.warn('[CheatSheetGen] Mem0 milestones fetch failed, using default timeline.');
        }

        if (userMilestones.length === 0) {
            userMilestones = [
                { memory: 'Skills: Advanced React, Node.js, Next.js, TypeScript, PostgreSQL, Supabase' },
                { memory: 'Project: Deployed a full-stack Next.js Obsidian Dashboard with real-time browser agent automation' },
                { memory: 'Project: Designed a Supabase pgvector hybrid search index (3072 dimensions) with full-text search fallback' },
                { memory: 'Achievement: Built self-correcting validation loop inside an isolated Linux/Python sandbox' }
            ];
        }

        const candidateFacts = userMilestones.map(m => m.memory || m.text || m.content || '').filter(Boolean);

        // 2. Query Supabase vector database for matching corporate culture guidelines
        let matchingGuidelines = [];
        try {
            matchingGuidelines = await searchKnowledgeBase(companyName + " culture values interview prep", 0.2, 3, 'hybrid');
        } catch (e) {
            console.warn('[CheatSheetGen] RAG search failed.');
        }

        const formattedGuidelines = matchingGuidelines.map(g => g.content).join('\n— ');

        // 3. Build synthesis prompt for Gemini
        const systemPrompt = `You are a Principal Executive Career Coach and Corporate Recruiter Analyst.
Your goal is to construct a premium, high-impact "Recruiter Cheat-Sheet" markdown card.
This card helps a recruiter immediately understand why this candidate is a stellar fit for ${companyName}, mapping their real experience to company culture and role criteria.`;

        const userPrompt = `
COMPANY NAME: ${companyName}
TARGET ROLE DETAILS / JOB DESCRIPTION:
${jobDescription || 'Software Engineer / AI Systems Developer'}

CANDIDATE MILESTONES (FROM MEM0):
${candidateFacts.map((f, i) => `- ${f}`).join('\n')}

RETRIEVED CORPORATE CULTURE/INTERVIEW GUIDELINES (FROM RAG):
${formattedGuidelines || 'Focus on ownership, deep technical excellence, clean code, and fast shipping.'}

Please synthesize the above inputs into a gorgeous, highly structured markdown "Recruiter Cheat-Sheet" card.
Structure it with these exact premium sections:
1. 🎯 **The Elevator Pitch**: A compelling 3-sentence summary of why they are the absolute #1 candidate.
2. 💎 **Culture Fit Alignment**: Map specific candidate achievements to ${companyName}'s core values.
3. ⚡ **Key Interview Talking Points**: Highlight 3-4 specific projects or achievements with concrete metrics.
4. 🧠 **Suggested Icebreaker Questions**: 3 thoughtful, role-specific questions the recruiter should ask the candidate.

Use bold text, bullet points, and elegant markdown spacing. Do not include any meta-commentary. Start directly with the Markdown heading.`;

        let markdownResult = '';
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const isOnline = apiKey && !apiKey.includes('your_gemini');

        if (isOnline) {
            console.log("Synthesizing premium cheat-sheet content using Google Gemini Pro...");
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const response = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }]
            });
            markdownResult = response.response.text().trim();
        } else {
            console.log("Gemini API key not configured. Generating high-fidelity mock card.");
            markdownResult = `# ⚡ RECRUITER CHEAT-SHEET: SHREY SHARMA for ${companyName}
            
## 🎯 The Elevator Pitch
Shrey Sharma is an exceptional AI Systems and Full-Stack Engineer who brings immediate value in autonomous agents and database optimizations. With a proven track record of constructing self-correcting validation loops inside isolated Linux containers and deploying 3072-dimensional pgvector RAG systems, Shrey bridges the gap between complex AI logic and premium, responsive user interfaces. Shrey possesses a fast-shipping ownership mindset, making them the ideal candidate to spearhead enterprise production readiness at ${companyName}.

## 💎 Culture Fit Alignment
*   **Deep Technical Excellence**: Shrey engineered a Supabase pgvector hybrid search system combining semantic similarity with full-text search fallback, mirroring ${companyName}'s commitment to world-class technical execution.
*   **Ownership & Autonomy**: Independently designed and deployed an Obsidian-styled Career command center dashboard featuring autonomous Chromium browser automation logs.
*   **Fast Shipping & Iteration**: Completed the full integration of stateful Mem0 episodic context tracking across three major server architectures under tight constraints.

## ⚡ Key Interview Talking Points
1.  **Autonomous Agent Dev**: Ask about the Next.js Obsidian Dashboard featuring direct integration with Chromium user profile folders for session-authenticated job form crawling.
2.  **Vector RAG Hardening**: Ask how the 3072-dimensional pgvector system achieves near 100% precision by merging full-text BM25 index scores via Reciprocal Rank Fusion.
3.  **Self-Correcting Loops**: Ask how Shrey implemented the Claude self-correction quality loop inside isolated Python sandboxes to optimize resume parsing above a 90% benchmark score.

## 🧠 Suggested Icebreaker Questions
*   *\"I see you configured a self-correcting quality validation loop using an isolated Python sandbox. How did you handle runtime timeouts and security limitations during high concurrent loads?\"*
*   *\"Your portfolio compiles dynamic milestone summaries from a Mem0 memory database. How did you design the semantic deduplication loop to prune redundant facts?\"*
*   *\"At ${companyName}, we value extreme speed and high-fidelity user experiences. What design choices did you make in your premium obsidian dashboard to wow users at first glance?\"*
            
_Generated by ResumeVault AI • Stateful Context & pgvector RAG_`;
        }

        // Save sheet to the public folder for static display/download
        const publicDir = path.join(__dirname, '..', 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        const fileName = `cheat_sheet_${companyName.toLowerCase().replace(/\s+/g, '_')}.md`;
        const filePath = path.join(publicDir, fileName);
        fs.writeFileSync(filePath, markdownResult, 'utf8');

        console.log(`✅ Recruiter Cheat-Sheet generated at: ${filePath}`);
        
        return {
            success: true,
            company: companyName,
            markdown: markdownResult,
            filePath,
            publicUrl: `/public/${fileName}`
        };

    } catch (error) {
        console.error("❌ Failed to generate Recruiter Cheat-Sheet:", error.message);
        throw error;
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const company = args[0] || 'Vercel';
    const jd = args[1] || 'We are looking for a Senior Developer with expertise in Next.js, pgvector, custom AI integrations, and high-performance server tooling.';
    generateRecruiterCheatSheet('agent-zero-user', company, jd).then(res => {
        console.log("\n----- Generated Markdown Card -----");
        console.log(res.markdown);
    });
}

module.exports = { generateRecruiterCheatSheet };
