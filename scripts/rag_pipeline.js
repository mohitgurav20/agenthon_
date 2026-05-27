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
 * Searches the Supabase documents table using RAG / Vector similarity
 * @param {string} query - The search query
 * @param {number} matchThreshold - Minimum similarity threshold (e.g., 0.5)
 * @param {number} matchCount - Max number of chunks to return
 * @returns {Promise<Array>} List of relevant document chunks
 */
async function searchKnowledgeBase(query, matchThreshold = 0.5, matchCount = 5) {
    if (!query) {
        console.error("Missing query for RAG search.");
        return [];
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey || apiKey.includes('your_gemini_api_key_here')) {
            console.warn("WARNING: GEMINI_API_KEY is not set or contains a placeholder. Skipping similarity search query embedding.");
            return [];
        }

        console.log(`Generating embedding for query: "${query}"...`);
        // Use gemini-embedding-2
        const model = genAI.getGenerativeModel({ 
            model: "gemini-embedding-2",
            systemInstruction: "This model is used exclusively for generating text embeddings."
        });
        const result = await model.embedContent(query);
        const embedding = result.embedding.values;

        console.log("Searching Supabase pgvector...");
        // Call the match_documents RPC function defined in schema.sql
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: matchThreshold,
            match_count: matchCount
        });

        if (error) {
            throw error;
        }

        console.log("Supabase RAG retrieval successful.");
        return data || [];
    } catch (error) {
        console.error("Error in Supabase RAG Pipeline:", error);
        return [];
    }
}

// Allow script execution from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const query = args[0] || "What is the capital of France?";
    
    searchKnowledgeBase(query).then(results => {
        console.log(JSON.stringify(results, null, 2));
    });
}

module.exports = { searchKnowledgeBase };
