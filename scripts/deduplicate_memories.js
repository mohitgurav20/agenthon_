/**
 * ⚡ AGENT ZERO - MEM0 FACT DEDUPLICATION & CONSOLIDATION LOOP
 * 
 * Scans a user's conversational memories, identifies overlapping semantic assertions,
 * merges redundant facts, and purges duplicate entries to optimize LLM context size.
 */

require('dotenv').config();
const { MemoryClient } = require('mem0ai');

let mem0Client;
try {
    mem0Client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });
} catch (e) {
    console.warn("⚠️  Mem0 client failed to initialize:", e.message);
}

/**
 * Periodically prunes and consolidates user facts.
 * @param {string} userId - The user ID to deduplicate
 */
async function deduplicateUserMemories(userId) {
    console.log(`\n🧠 [Mem0 Deduplicator] Scanning memory profile for user "${userId}"...`);

    const isOnline = process.env.MEM0_API_KEY && !process.env.MEM0_API_KEY.includes('your_');

    if (!isOnline) {
        console.warn("⚠️  Mem0 API key is not configured. Running in high-fidelity Deduplication Simulation.");
        
        const initialMemories = [
            { id: "mem-1", text: "Mohit is our lead designer." },
            { id: "mem-2", text: "Mohit Gurav is the team lead." },
            { id: "mem-3", text: "User prefers high-contrast dark mode." },
            { id: "mem-4", text: "User likes dark theme UI layouts." },
            { id: "mem-5", text: "Meeting schedule is set for morning hours." }
        ];

        console.log("Found 5 active user memories. Analyzing semantic overlaps...");
        await new Promise(r => setTimeout(r, 1500));

        console.log("Overlapping assertions detected:");
        console.log(`- "mem-1" and "mem-2" both define user role / identity.`);
        console.log(`- "mem-3" and "mem-4" both define UI theme preference.`);

        console.log("\nMerging and updating facts...");
        const consolidatedMemories = [
            { id: "mem-1", text: "Mohit Gurav is our lead designer and team lead." },
            { id: "mem-3", text: "User prefers high-contrast dark mode UI theme layouts." },
            { id: "mem-5", text: "Meeting schedule is set for morning hours." }
        ];

        await new Promise(r => setTimeout(r, 1000));
        console.log("Updates applied successfully:");
        console.log(`- Updated "mem-1" text content.`);
        console.log(`- Updated "mem-3" text content.`);
        console.log(`- Deleted redundant "mem-2" from profile.`);
        console.log(`- Deleted redundant "mem-4" from profile.`);

        console.log("\n✅ MEMORY DEDUPLICATION TASK COMPLETE!");
        return {
            success: true,
            simulated: true,
            beforeCount: 5,
            afterCount: 3,
            consolidated: consolidatedMemories
        };
    }

    try {
        let memories = [];
        try {
            console.log("Querying all user memories from Mem0 via getAll()...");
            const allResult = await mem0Client.getAll({
                filters: { user_id: userId }
            });
            memories = allResult.results || allResult || [];
        } catch (getAllError) {
            console.warn("⚠️ mem0Client.getAll() failed or unsupported. Falling back to broad semantic search queries...", getAllError.message);
            const searchResult = await mem0Client.search("preferences name identity core values skills project experience work background", { 
                filters: { user_id: userId },
                limit: 100
            });
            memories = searchResult.results || searchResult || [];
        }
        if (memories.length === 0) {
            console.log("No memories found for user. Nothing to deduplicate.");
            return { success: true, beforeCount: 0, afterCount: 0 };
        }

        console.log(`Found ${memories.length} memories. Checking for semantic duplicates...`);
        const toDelete = [];
        const toUpdate = [];

        // Deduplication algorithm based on keyword mapping and string containment
        for (let i = 0; i < memories.length; i++) {
            const factA = (memories[i].memory || memories[i].text || "").toLowerCase();
            const idA = memories[i].id;

            if (toDelete.includes(idA)) continue;

            for (let j = i + 1; j < memories.length; j++) {
                const factB = (memories[j].memory || memories[j].text || "").toLowerCase();
                const idB = memories[j].id;

                if (toDelete.includes(idB)) continue;

                // Simple keyword containment check for overlap
                const wordsA = factA.split(" ").filter(w => w.length > 3);
                const wordsB = factB.split(" ").filter(w => w.length > 3);
                
                // Calculate Jaccard similarity index
                const intersection = wordsA.filter(w => wordsB.includes(w));
                const union = [...new Set([...wordsA, ...wordsB])];
                const similarity = intersection.length / union.length;

                if (similarity > 0.4) {
                    console.log(`\n[Overlap Detected] "${memories[i].memory || memories[i].text}" <--> "${memories[j].memory || memories[j].text}"`);
                    // Merge B into A (simply choose the longer fact or combine them)
                    const mergedText = (factA.length >= factB.length) 
                        ? (memories[i].memory || memories[i].text) 
                        : (memories[j].memory || memories[j].text);
                    
                    toUpdate.push({ id: idA, text: mergedText });
                    toDelete.push(idB);
                }
            }
        }

        console.log(`\nExecuting updates (${toUpdate.length}) and deletions (${toDelete.length})...`);
        
        // Execute deletions
        for (const id of toDelete) {
            await mem0Client.delete(id);
            console.log(`Deleted memory: ${id}`);
        }

        // Execute updates
        for (const update of toUpdate) {
            // Note: Mem0 Client update method uses client.update(id, text) or similar
            // In our client we update text
            await mem0Client.update(update.id, { text: update.text });
            console.log(`Updated memory ${update.id} to: "${update.text}"`);
        }

        console.log("✅ MEM0 DEDUPLICATION LOOP FINISHED!");
        return {
            success: true,
            beforeCount: memories.length,
            afterCount: memories.length - toDelete.length
        };
    } catch (error) {
        console.error("❌ Error in deduplication loop:", error.message);
        throw error;
    }
}

if (require.main === module) {
    const userId = process.env.MEM0_DEFAULT_USER_ID || "agent-zero-user";
    deduplicateUserMemories(userId);
}

module.exports = { deduplicateUserMemories };
