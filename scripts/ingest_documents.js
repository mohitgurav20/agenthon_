require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Initialize Gemini for Embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generates embeddings for text and stores it in the Supabase documents table
 * @param {string} content - The text content to embed and store
 * @param {object} metadata - Optional metadata (e.g., source, author)
 */
async function ingestDocument(content, metadata = {}) {
    if (!content) {
        console.error("Missing content to ingest.");
        return;
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey || apiKey.includes('your_gemini_api_key_here')) {
            console.warn("WARNING: GEMINI_API_KEY is not set or contains a placeholder. Skipping document embedding generation.");
            return null;
        }

        console.log("Generating embedding for content...");
        // Use gemini-embedding-2
        const model = genAI.getGenerativeModel({ 
            model: "gemini-embedding-2",
            systemInstruction: "This model is used exclusively for generating text embeddings."
        });
        const result = await model.embedContent(content);
        const embedding = result.embedding.values;

        console.log("Storing document and embedding in Supabase pgvector...");
        const { data, error } = await supabase
            .from('documents')
            .insert([
                {
                    content: content,
                    metadata: metadata,
                    embedding: embedding
                }
            ])
            .select();

        if (error) {
            throw error;
        }

        console.log("Document successfully ingested!");
        return data;
    } catch (error) {
        console.error("Error ingesting document:", error);
    }
}

// Allow script execution from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const content = args[0] || "Agent Zero is a multi-agent system built with Antigravity, n8n, Mem0, and Supabase.";
    
    ingestDocument(content, { source: "cli_ingestion", type: "system_knowledge" }).then(result => {
        if (result) console.log(JSON.stringify(result, null, 2));
    });
}

module.exports = { ingestDocument };
