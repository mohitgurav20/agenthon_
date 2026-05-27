require('dotenv').config();
const { storeMemory } = require('./store_memory');
const { retrieveMemory } = require('./retrieve_memory');
const { buildContext } = require('./build_context');

/**
 * Simulates cross-session persistent memory retrieval
 */
async function runPersistenceTest() {
    console.log("=========================================");
    console.log("🚀 STARTING E2E SESSION PERSISTENCE TEST");
    console.log("=========================================");

    const userId = "persistence-test-user-" + Date.now();
    const factToRemember = "I work on an AI Hackathon project and my team name is Agent Zero.";

    console.log(`\n--- [Session 1: Store Memory] ---`);
    console.log(`User Input: "${factToRemember}"`);
    console.log(`Storing facts for User ID: ${userId}...`);

    const storeResult = await storeMemory(factToRemember, userId);
    if (!storeResult) {
        console.error("❌ Failed to store memory in Session 1.");
        process.exit(1);
    }
    console.log("✅ Fact stored successfully!");

    // Mem0 runs async background processing to extract facts, wait 5 seconds to ensure it is indexable
    console.log("\nWaiting 5 seconds for Mem0 semantic extraction...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`\n--- [Session 2: Retrieve Memory] ---`);
    console.log(`Retrieving memory for user ${userId} using query: "What is my hackathon team name?"`);

    const memories = await retrieveMemory("What is my hackathon team name?", userId);
    console.log("Raw Retrieved Memories:", JSON.stringify(memories, null, 2));

    const factExists = memories.some(mem => {
        const text = mem.memory || mem.text || mem.content || "";
        return text.toLowerCase().includes("agent zero") || text.toLowerCase().includes("hackathon");
    });

    if (factExists) {
        console.log("\n=========================================");
        console.log("🎉 SUCCESS: Session Persistence Verified!");
        console.log("Mem0 correctly remembered user facts across sessions!");
        console.log("=========================================");
        
        // Final combined context check
        console.log(`\n--- [Final Combined Context Check] ---`);
        const finalContext = await buildContext("Where do I work and what is my team?", userId);
        console.log(finalContext);
        
        process.exit(0);
    } else {
        console.error("\n=========================================");
        console.error("❌ FAILURE: Facts not retrieved.");
        console.error("The stored facts could not be semantically retrieved.");
        console.error("=========================================");
        process.exit(1);
    }
}

runPersistenceTest().catch(err => {
    console.error("Unexpected error in E2E test:", err);
    process.exit(1);
});
