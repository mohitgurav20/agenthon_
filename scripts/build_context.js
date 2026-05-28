require('dotenv').config();
const { retrieveMemory } = require('./retrieve_memory');
const { searchKnowledgeBase } = require('./rag_pipeline');

/**
 * Builds the combined context by executing Mem0 and Supabase RAG in parallel
 * @param {string} query - The user's query
 * @param {string} userId - The user ID
 * @param {string} [cluster] - Optional memory cluster filter (e.g. 'user-preferences')
 * @returns {Promise<string>} The formatted context string
 */
async function buildContext(query, userId, cluster) {
    if (!query || !userId) {
        console.error("Missing query or userId.");
        return "";
    }

    console.log(`Building combined context for user ${userId}${cluster ? ` [Cluster: ${cluster}]` : ''}...`);
    
    try {
        // Run both retrievals in parallel
        const [memories, knowledgeBaseDocs] = await Promise.all([
            retrieveMemory(query, userId, cluster),
            searchKnowledgeBase(query)
        ]);

        let contextString = "USER CONTEXT:\n\n";

        // Format Conversational Memories
        contextString += "[Conversational Memories]:\n";
        if (memories && memories.length > 0) {
            memories.forEach((mem, index) => {
                // Mem0 search result structure typically contains a 'memory' string
                const content = mem.memory || mem.text || mem.content || JSON.stringify(mem);
                contextString += `${index + 1}. ${content}\n`;
            });
        } else {
            contextString += "No relevant conversational memories found.\n";
        }

        contextString += "\n[Knowledge Base]:\n";
        if (knowledgeBaseDocs && knowledgeBaseDocs.length > 0) {
            knowledgeBaseDocs.forEach((doc, index) => {
                contextString += `${index + 1}. ${doc.content}\n`;
            });
        } else {
            contextString += "No relevant knowledge base documents found.\n";
        }

        return contextString;
    } catch (error) {
        console.error("Error building combined context:", error);
        return "USER CONTEXT: Error retrieving context.";
    }
}

// Allow script execution from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const query = args[0] || "What is my preferred UI theme and what are the system requirements?";
    const userId = args[1] || process.env.MEM0_DEFAULT_USER_ID || "agent-zero-user";
    
    buildContext(query, userId).then(context => {
        console.log("----- Final Output -----");
        console.log(context);
    });
}

module.exports = { buildContext };
