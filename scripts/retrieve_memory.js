require('dotenv').config();
const { MemoryClient } = require('mem0ai');

// Initialize Mem0 Client
const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

/**
 * Retrieves memories from Mem0 using semantic search
 * @param {string} query - The search query
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} List of relevant memories
 */
async function retrieveMemory(query, userId) {
    if (!query || !userId) {
        console.error("Missing query or userId.");
        return [];
    }

    try {
        console.log(`Retrieving memories for user ${userId} with query: "${query}"...`);
        
        // Mem0 search automatically handles embeddings and semantic search
        const results = await client.search(query, { filters: { user_id: userId }, limit: 5 });
        
        console.log("Memory successfully retrieved.");
        return results.results || results;
    } catch (error) {
        console.error("Error retrieving memory:", error);
        return [];
    }
}

// Allow script execution from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const query = args[0] || "What are my preferences?";
    const userId = args[1] || process.env.MEM0_DEFAULT_USER_ID || "agent-zero-user";
    
    retrieveMemory(query, userId).then(results => {
        console.log(JSON.stringify(results, null, 2));
    });
}

module.exports = { retrieveMemory };
