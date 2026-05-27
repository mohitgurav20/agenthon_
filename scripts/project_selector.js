/**
 * ⚡ RESUMEVAULT AI - PGVECTOR RAG PROJECT SELECTOR
 * 
 * Takes a target job description, performs a 3072-dimensional hybrid search (RRF)
 * against the Supabase candidate knowledge base, retrieves only the most relevant
 * public repository projects, and compiles a structured Markdown resume block.
 */

require('dotenv').config();
const { searchKnowledgeBase } = require('./rag_pipeline');

/**
 * Selects and formats the most relevant candidate projects matching a target job
 * @param {string} jobDescription - Target job role details/requirements
 * @returns {Promise<string>} Markdown block of matching projects
 */
async function selectRelevantProjects(jobDescription) {
    console.log(`\n🗄️  [RAG Selector] Finding relevant projects for job requirements:`);
    console.log(`"${jobDescription.substring(0, 100)}..."`);

    try {
        // Run pgvector RRF Hybrid Search (BM25 + Cosine similarity)
        // Set matchThreshold to 0.1 to be inclusive during matching, returning top 3
        const matches = await searchKnowledgeBase(jobDescription, 0.1, 3, 'hybrid');

        if (!matches || matches.length === 0) {
            console.log("ℹ️  [RAG Selector] No relevant projects found in database. Returning fallback default projects.");
            return `### MOCK PROJECT - Wisdom CLI (Python)
- Developed an advanced stateful wisdom command-line agent using Python, combining philosophical insights with interactive CLI prompts.
- Configured local state persistence modules for long-term thread caching.

### MOCK PROJECT - Transport Management System
- Implemented a public transit optimizer using Javascript, handling dynamic scheduling and route optimizations.`;
        }

        console.log(`✅ [RAG Selector] Retrieved ${matches.length} matching candidate projects.`);
        
        let markdownOutput = `## Tailored Relevant Projects\n\n`;

        matches.forEach((match, index) => {
            const metadata = match.metadata || {};
            const repoName = metadata.repo_name || `Project ${index + 1}`;
            const language = metadata.language || 'Software Engineering';
            
            console.log(`- Project Match #${index + 1}: "${repoName}" [Score: ${match.rrf_score ? match.rrf_score.toFixed(4) : 'N/A'}]`);

            markdownOutput += `### 🐙 ${repoName} (${language})\n`;
            
            // Extract a summary or use full content (truncate README if too large)
            let contentBody = match.content || "";
            // Remove full README header if present to keep it concise for resume bullet points
            const lines = contentBody.split('\n');
            const summaryLines = lines.filter(l => !l.startsWith('README:') && !l.startsWith('Owner:') && !l.startsWith('Repository:'));
            
            // Formulate neat bullets representing this repository project
            markdownOutput += summaryLines.slice(0, 10).join('\n') + `\n\n`;
        });

        return markdownOutput;
    } catch (err) {
        console.error("❌ RAG Project Selector failed:", err.message);
        return "";
    }
}

// Standalone CLI Verification
if (require.main === module) {
    const args = process.argv.slice(2);
    const jobDescription = args[0] || "Python CLI tool developer with SQL database integration experience";
    
    selectRelevantProjects(jobDescription).then(markdown => {
        console.log("\n=================================================");
        console.log("📝 GENERATED TAILORED PROJECTS RESUME BLOCK");
        console.log("=================================================");
        console.log(markdown);
        console.log("=================================================");
        process.exit(0);
    }).catch(() => process.exit(1));
}

module.exports = { selectRelevantProjects };
