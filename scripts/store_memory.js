require('dotenv').config();
const { MemoryClient } = require('mem0ai');

// Initialize Mem0 Client
const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

/**
 * Stores a memory into Mem0
 * @param {string} text - The user's message/text to extract facts from
 * @param {string} userId - The user ID
 */
async function storeMemory(text, userId) {
    if (!text || !userId) {
        console.error("Missing text or userId.");
        return;
    }

    try {
        console.log(`Storing memory for user ${userId}...`);
        const messages = [{ role: 'user', content: text }];
        
        // Mem0 automatically extracts facts and stores them
        const result = await client.add(messages, { user_id: userId });
        
        console.log("Memory successfully stored.");
        console.log(JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error("Error storing memory:", error);
        throw error;
    }
}

// Allow script execution from CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const text = args[0] || "My name is Mohit and I prefer dark mode.";
    const userId = args[1] || process.env.MEM0_DEFAULT_USER_ID || "agent-zero-user";
    
    storeMemory(text, userId)
        .then(() => process.exit(0))
        .catch(err => {
            console.error("Failed to store memory:", err);
            process.exit(1);
        });
}

module.exports = { storeMemory };
