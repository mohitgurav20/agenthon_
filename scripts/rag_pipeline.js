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
 * Searches the Supabase documents table using RAG / Vector similarity or Hybrid Search
 * @param {string} query - The search query
 * @param {number} matchThreshold - Minimum similarity threshold (e.g., 0.5)
 * @param {number} matchCount - Max number of chunks to return
 * @param {string} searchType - Search strategy: 'semantic' (default) or 'hybrid'
 * @returns {Promise<Array>} List of relevant document chunks
 */
async function searchKnowledgeBase(query, matchThreshold = 0.5, matchCount = 5, searchType = 'hybrid') {
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

        console.log(`Searching Supabase via [${searchType.toUpperCase()}] search strategy...`);
        
        let data = [];
        let error = null;

        if (searchType === 'hybrid') {
            // Call the hybrid search RPC function matching the schema
            const rpcResult = await supabase.rpc('match_documents_hybrid', {
                query_text: query,
                query_embedding: embedding,
                match_threshold: matchThreshold,
                match_count: matchCount
            });
            data = rpcResult.data;
            error = rpcResult.error;

            if (error) {
                console.warn("⚠️  match_documents_hybrid RPC failed or not deployed. Falling back to standard semantic search...");
                const fallbackResult = await supabase.rpc('match_documents', {
                    query_embedding: embedding,
                    match_threshold: matchThreshold,
                    match_count: matchCount
                });
                data = fallbackResult.data;
                error = fallbackResult.error;
            }
        } else {
            // Standard semantic similarity search RPC
            const rpcResult = await supabase.rpc('match_documents', {
                query_embedding: embedding,
                match_threshold: matchThreshold,
                match_count: matchCount
            });
            data = rpcResult.data;
            error = rpcResult.error;
        }

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
    const type = args[1] || "hybrid";
    
    searchKnowledgeBase(query, 0.3, 5, type).then(results => {
        console.log(JSON.stringify(results, null, 2));
    });
}

// ═══════════════════════════════════════════════════════════════
//  🆕 ADVANCED HYBRID SEARCH FUNCTIONS (Post-Integration Tasks)
// ═══════════════════════════════════════════════════════════════

/**
 * Performs RRF hybrid search and returns FULL scoring breakdown.
 * Unlike searchKnowledgeBase, this always uses hybrid mode and exposes
 * both the cosine `similarity` and the fused `rrf_score` per result.
 *
 * @param {string} query - Natural language search query
 * @param {Object} [options] - Search options
 * @param {number} [options.matchThreshold=0.3] - Minimum cosine similarity
 * @param {number} [options.matchCount=5] - Max results to return
 * @param {number} [options.rrfK=60] - RRF constant (higher = more weight on keyword)
 * @returns {Promise<Array<{id, content, metadata, similarity, rrf_score}>>}
 */
async function searchHybridWithScoring(query, options = {}) {
    const {
        matchThreshold = 0.3,
        matchCount = 5,
        rrfK = 60
    } = options;

    if (!query) {
        console.error("[HybridScoring] Missing query.");
        return [];
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey || apiKey.includes('your_gemini_api_key_here')) {
            console.warn("[HybridScoring] GEMINI_API_KEY not configured. Returning empty.");
            return [];
        }

        console.log(`[HybridScoring] Embedding query: "${query.substring(0, 60)}..."`);
        const model = genAI.getGenerativeModel({
            model: "gemini-embedding-2",
            systemInstruction: "This model is used exclusively for generating text embeddings."
        });
        const result = await model.embedContent(query);
        const embedding = result.embedding.values;

        const { data, error } = await supabase.rpc('match_documents_hybrid', {
            query_text: query,
            query_embedding: embedding,
            match_threshold: matchThreshold,
            match_count: matchCount,
            rrf_k: rrfK
        });

        if (error) {
            console.error("[HybridScoring] RPC error:", error.message);
            throw error;
        }

        console.log(`[HybridScoring] ✅ Found ${(data || []).length} results.`);
        return data || [];
    } catch (error) {
        console.error("[HybridScoring] Pipeline error:", error.message);
        return [];
    }
}

/**
 * Resilient search cascade: tries hybrid → semantic → keyword-only FTS.
 * Guarantees results unless the database is truly empty for the query.
 *
 * @param {string} query - Search query
 * @param {number} [matchCount=5] - Max results per strategy
 * @returns {Promise<{results: Array, strategy: string}>}
 */
async function searchWithFallbackChain(query, matchCount = 5) {
    if (!query) return { results: [], strategy: 'none' };

    // Strategy 1: Hybrid RRF
    console.log(`[FallbackChain] Trying HYBRID search...`);
    const hybridResults = await searchKnowledgeBase(query, 0.2, matchCount, 'hybrid');
    if (hybridResults && hybridResults.length > 0) {
        console.log(`[FallbackChain] ✅ Hybrid returned ${hybridResults.length} results.`);
        return { results: formatRagResults(hybridResults, 'hybrid'), strategy: 'hybrid' };
    }

    // Strategy 2: Pure semantic vector search (lower threshold)
    console.log(`[FallbackChain] Hybrid empty. Trying SEMANTIC search...`);
    const semanticResults = await searchKnowledgeBase(query, 0.15, matchCount, 'semantic');
    if (semanticResults && semanticResults.length > 0) {
        console.log(`[FallbackChain] ✅ Semantic returned ${semanticResults.length} results.`);
        return { results: formatRagResults(semanticResults, 'semantic'), strategy: 'semantic' };
    }

    // Strategy 3: Keyword-only Full-Text Search via direct Supabase query
    console.log(`[FallbackChain] Semantic empty. Trying KEYWORD FTS...`);
    try {
        const { data, error } = await supabase
            .from('documents')
            .select('id, content, metadata')
            .textSearch('content', query, { type: 'plain', config: 'english' })
            .limit(matchCount);

        if (!error && data && data.length > 0) {
            console.log(`[FallbackChain] ✅ FTS returned ${data.length} results.`);
            const ftsFormatted = data.map(d => ({
                ...d,
                similarity: null,
                rrf_score: null
            }));
            return { results: formatRagResults(ftsFormatted, 'keyword'), strategy: 'keyword' };
        }
    } catch (ftsError) {
        console.warn("[FallbackChain] FTS query failed:", ftsError.message);
    }

    console.log(`[FallbackChain] ⚠️  All strategies exhausted. No results found.`);
    return { results: [], strategy: 'exhausted' };
}

/**
 * Normalizes RAG results into a clean, consumer-friendly format.
 *
 * @param {Array} rawResults - Raw results from any search strategy
 * @param {string} [source='unknown'] - Which strategy produced these results
 * @returns {Array<{rank, content, source, metadata, scores}>}
 */
function formatRagResults(rawResults, source = 'unknown') {
    if (!rawResults || !Array.isArray(rawResults)) return [];

    return rawResults.map((item, index) => ({
        rank: index + 1,
        content: item.content || '',
        source: source,
        metadata: item.metadata || {},
        scores: {
            similarity: item.similarity ?? null,
            rrf_score: item.rrf_score ?? null
        }
    }));
}

module.exports = {
    searchKnowledgeBase,
    searchHybridWithScoring,
    searchWithFallbackChain,
    formatRagResults
};
