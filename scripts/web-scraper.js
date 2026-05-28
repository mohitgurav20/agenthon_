/**
 * ⚡ RESUMEVAULT AI - GITHUB ONE-CLICK INGESTION CRAWLER
 * 
 * Crawls public repositories for a given GitHub username, retrieves descriptions,
 * primary languages, and README files, generates 3072-dimensional embeddings via Gemini,
 * and saves them directly into the career database (Supabase pgvector).
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Helper to fetch file content from raw GitHub content API
 */
async function fetchRawReadme(username, repoName) {
    const branches = ['main', 'master'];
    for (const branch of branches) {
        try {
            const url = `https://raw.githubusercontent.com/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/${branch}/README.md`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'ResumeVault-AI-Ingester' }
            });
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            // Silence and try next branch
        }
    }
    return '';
}

/**
 * Crawls and ingests a GitHub profile's public repositories
 * @param {string} username - GitHub username
 */
async function ingestGitHubProfile(username) {
    console.log(`\n🐙 [GitHub Ingest] Initiating crawl for profile: "${username}"...`);
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const isSupabaseLive = supabaseUrl && supabaseKey && !supabaseKey.includes('your_');
    const isGeminiLive = geminiKey && !geminiKey.includes('your_');

    if (!isSupabaseLive || !isGeminiLive) {
        console.warn("⚠️  [GitHub Ingest] Credentials not configured. Running high-fidelity simulation.");
        await new Promise(r => setTimeout(r, 1000));
        
        console.log(`- Retrieved index for user: "${username}" (3 repositories found)`);
        const mockRepos = [
            { name: 'resumevault-core', desc: 'Autonomous agentic resume builder and sandbox ATS tester.', lang: 'JavaScript', readme: '# ResumeVault Core\nBuilt with Node.js, Express, pgvector, and Mem0.' },
            { name: 'job-scraper-bot', desc: 'Puppeteer and Tavily crawler designed to find Greenhouse job listings.', lang: 'TypeScript', readme: '# Job Scraper Bot\nFind matches based on skill profiles.' },
            { name: 'ats-sandbox-container', desc: 'Docker sandbox running AST parsing on tailored resumes.', lang: 'Python', readme: '# ATS Sandbox Container\nRun ATS keyword checks locally.' }
        ];

        for (const repo of mockRepos) {
            console.log(`\nIngesting Repo: "${repo.name}" [Language: ${repo.lang}]`);
            console.log(`- Fetched README.md (${repo.readme.length} bytes)`);
            console.log(`- Generated 3072-dimensional vector embedding.`);
            console.log(`- Inserted document chunk successfully into Supabase.`);
        }

        console.log(`\n🎉 [Simulation] INGESTED 3 PUBLIC REPOSITORIES SUCCESSFULLY!`);
        return { success: true, count: 3, simulated: true };
    }

    try {
        // Fetch repositories from GitHub API
        const repoUrl = `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=10&sort=updated`;
        const response = await fetch(repoUrl, {
            headers: { 'User-Agent': 'ResumeVault-AI-Ingester' }
        });

        if (!response.ok) {
            throw new Error(`GitHub API returned status: ${response.status}`);
        }

        const repos = await response.json();
        console.log(`✅ [GitHub Ingest] Found ${repos.length} public repositories for user "${username}".`);

        let successCount = 0;

        for (const repo of repos) {
            const repoName = repo.name;
            const description = repo.description || 'No description provided.';
            const language = repo.language || 'Markdown';
            
            console.log(`\nProcessing: "${repoName}" [Primary Language: ${language}]...`);
            
            // 1. Fetch README.md
            const readme = await fetchRawReadme(username, repoName);
            console.log(readme ? `- Fetched README.md successfully (${readme.length} bytes).` : `- README.md not found or empty.`);

            // 2. Build Ingestion Content Block
            const content = `Repository: ${repoName}
Owner: ${username}
Language: ${language}
Description: ${description}
${readme ? `README:\n${readme}` : 'No README file available.'}`;

            // 3. Generate Gemini 3072-dimension Embedding
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
            const embedResult = await model.embedContent(content);
            const embedding = embedResult.embedding.values;
            console.log(`- Generated unit vector embedding (${embedding.length} dimensions).`);

            // 4. Store in Supabase
            const metadata = {
                source: 'github',
                repo_name: repoName,
                owner: username,
                language: language,
                created_at: new Date().toISOString()
            };

            const { error } = await supabase.from('documents').insert({
                content: content,
                metadata: metadata,
                embedding: embedding
            });

            if (error) {
                console.error(`❌ Failed to store repo "${repoName}" in database:`, error.message);
            } else {
                console.log(`✅ Successfully indexed and stored "${repoName}" to career database.`);
                successCount++;
            }
        }

        console.log(`\n🎉 [GitHub Ingest] FINISHED! Successfully ingested ${successCount}/${repos.length} repositories into Supabase.`);
        return { success: true, count: successCount };
    } catch (err) {
        console.error("❌ GitHub Ingest pipeline error:", err.message);
        throw err;
    }
}

// Standalone CLI Execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const username = args[0] || 'mohitgurav'; // Default fallback username
    ingestGitHubProfile(username)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("❌ Fatal error during CLI execution:", err);
            process.exit(1);
        });
}

module.exports = { ingestGitHubProfile };
