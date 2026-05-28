require('dotenv').config();
const { MemoryClient } = require('mem0ai');

// Initialize Mem0 Client
const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

// In-memory queue to batch episodic events aggressively
const batchQueue = new Map(); // Map<userId, Map<cluster, Array<string>>>
const flushTimeouts = new Map(); // Map<timeoutKey, NodeJS.Timeout>
const BATCH_FLUSH_DELAY_MS = 2000;

async function flushMemoryBatch(userId, cluster) {
    const clusterKey = cluster || 'default';
    const texts = batchQueue.get(userId)?.get(clusterKey);
    
    if (!texts || texts.length === 0) return null;
    
    // Isolate and capture the payload, clear the queue for the next batch
    const payload = [...texts];
    batchQueue.get(userId).set(clusterKey, []);
    
    try {
        console.log(`[Mem0 Batch] Flushing ${payload.length} events for user ${userId}${cluster ? ` [Cluster: ${cluster}]` : ''}...`);
        
        const messages = payload.map(text => ({ role: 'user', content: text }));
        const options = { user_id: userId };
        if (cluster) {
            options.metadata = { cluster: cluster };
        }

        const result = await client.add(messages, options);
        console.log(`[Mem0 Batch] ✅ Successfully isolated and stored ${payload.length} global events.`);
        return result;
    } catch (error) {
        console.error(`[Mem0 Batch] ❌ Error flushing memory batch for user ${userId}:`, error.message);
        throw error;
    }
}

/**
 * Stores a memory into Mem0 using aggressive batching to prevent API throttling
 * and securely isolate events globally per user.
 * @param {string} text - The user's message/text to extract facts from
 * @param {string} userId - The user ID
 * @param {string} [cluster] - Optional tagged memory cluster (e.g. 'user-preferences')
 */
async function storeMemory(text, userId, cluster) {
    if (!text || !userId) {
        console.error("Missing text or userId.");
        return;
    }

    const clusterKey = cluster || 'default';
    
    // Ensure nested maps exist
    if (!batchQueue.has(userId)) batchQueue.set(userId, new Map());
    if (!batchQueue.get(userId).has(clusterKey)) batchQueue.get(userId).set(clusterKey, []);
    
    batchQueue.get(userId).get(clusterKey).push(text);
    console.log(`[Mem0 Batch] Queueing event for user ${userId} -> "${text.substring(0, 30)}..."`);

    const timeoutKey = `${userId}:${clusterKey}`;
    
    // Clear the existing debounce timeout
    if (flushTimeouts.has(timeoutKey)) {
        clearTimeout(flushTimeouts.get(timeoutKey));
    }

    // Return a promise that resolves when the batch is flushed
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(async () => {
            flushTimeouts.delete(timeoutKey);
            try {
                const res = await flushMemoryBatch(userId, cluster);
                resolve(res);
            } catch (err) {
                reject(err);
            }
        }, BATCH_FLUSH_DELAY_MS);
        
        flushTimeouts.set(timeoutKey, timeout);
    });
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
