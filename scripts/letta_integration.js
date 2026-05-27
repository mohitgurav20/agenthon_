/**
 * ⚡ AGENT ZERO - LETTA (MEMGPT) INTEGRATION CLIENT
 * 
 * Provides stateful, persistent core & archival memory block management.
 * Falls back to high-fidelity simulated/mock memory if the Letta server is offline.
 */

require('dotenv').config();

const LETTA_SERVER_URL = process.env.LETTA_SERVER_URL || 'http://localhost:8283';

/**
 * Helper to check if Letta server is reachable
 */
async function checkLettaStatus() {
    try {
        const response = await fetch(`${LETTA_SERVER_URL}/v1/agents`, { 
            method: 'GET',
            signal: AbortSignal.timeout(1500) 
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Creates a new stateful Letta agent
 * @param {string} name 
 * @param {string} systemPrompt 
 */
async function createLettaAgent(name, systemPrompt) {
    console.log(`\n🤖 [Letta Client] Creating Agent: "${name}"...`);
    const isOnline = await checkLettaStatus();
    
    if (!isOnline) {
        console.warn(`⚠️ [Letta Client] Server at ${LETTA_SERVER_URL} is offline. Falling back to Simulated Mock Mode.`);
        // High-fidelity Simulated Response
        const simulatedAgentId = `agent-${Math.random().toString(36).substring(2, 11)}`;
        return {
            simulated: true,
            id: simulatedAgentId,
            name: name,
            system: systemPrompt,
            created_at: new Date().toISOString(),
            memory: {
                persona: `Name: ${name}\nRole: Persistent stateful agent.`,
                human: "Initial empty persistent state."
            }
        };
    }

    try {
        const response = await fetch(`${LETTA_SERVER_URL}/v1/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                system: systemPrompt
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ [Letta Client] Agent created successfully in server. ID: ${data.id}`);
        return data;
    } catch (error) {
        console.error(`❌ [Letta Client] Error creating agent on server:`, error.message);
        console.log(`👉 Falling back to Simulated Mode.`);
        const simulatedAgentId = `agent-${Math.random().toString(36).substring(2, 11)}`;
        return {
            simulated: true,
            id: simulatedAgentId,
            name: name,
            system: systemPrompt,
            created_at: new Date().toISOString()
        };
    }
}

/**
 * Sends a message to a Letta Agent and retrieves its stateful response
 * @param {string} agentId 
 * @param {string} messageText 
 */
async function sendLettaMessage(agentId, messageText) {
    console.log(`\n💬 [Letta Client] Sending message to agent "${agentId}": "${messageText}"`);
    const isOnline = await checkLettaStatus();

    if (!isOnline || agentId.startsWith('agent-')) {
        if (!isOnline) {
            console.warn(`⚠️ [Letta Client] Server is offline. Running in Simulated Mock Mode.`);
        }
        
        // Simulating Agent's thinking and response block updates
        let simulatedResponse = `[Simulation Response] Hello! I received your message: "${messageText}". `;
        if (messageText.toLowerCase().includes('name') || messageText.toLowerCase().includes('introduce')) {
            simulatedResponse += "I am Agent Zero, a stateful assistant. I have updated my persona memory block to remember who I am!";
        } else {
            simulatedResponse += "I am analyzing this request and saving relevant context in my core persistent human/persona memory blocks.";
        }

        return {
            simulated: true,
            messages: [
                {
                    id: `msg-user-${Math.random().toString(36).substring(2, 11)}`,
                    role: 'user',
                    text: messageText,
                    created_at: new Date().toISOString()
                },
                {
                    id: `msg-agent-${Math.random().toString(36).substring(2, 11)}`,
                    role: 'assistant',
                    text: simulatedResponse,
                    created_at: new Date().toISOString()
                }
            ],
            usage: { prompt_tokens: 45, completion_tokens: 82 }
        };
    }

    try {
        const response = await fetch(`${LETTA_SERVER_URL}/v1/agents/${agentId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageText,
                role: 'user'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ [Letta Client] Message processed successfully on server.`);
        return data;
    } catch (error) {
        console.error(`❌ [Letta Client] Error sending message:`, error.message);
        console.log(`👉 Falling back to Simulated response.`);
        return {
            simulated: true,
            messages: [
                { id: `msg-u-${Date.now()}`, role: 'user', text: messageText },
                { id: `msg-a-${Date.now()}`, role: 'assistant', text: `[Simulated Fallback] Received: "${messageText}". (Server offline)` }
            ]
        };
    }
}

/**
 * Gets the current persistent memory block of a Letta agent
 * @param {string} agentId 
 */
async function getLettaAgentMemory(agentId) {
    console.log(`\n🧠 [Letta Client] Fetching core memory for agent "${agentId}"...`);
    const isOnline = await checkLettaStatus();

    if (!isOnline || agentId.startsWith('agent-')) {
        return {
            simulated: true,
            core_memory: {
                persona: "Name: Agent Zero\nRole: Advanced stateful orchestrator.\nMission: Automate everything with premium multi-agent pipelines.",
                human: "User preferences: values efficiency, clean REST APIs, elegant code, and high-fidelity mock fallbacks."
            },
            blocks: [
                { label: "persona", value: "Name: Agent Zero\nRole: Advanced stateful orchestrator." },
                { label: "human", value: "User preferences: values efficiency, clean REST APIs, and elegant code." }
            ]
        };
    }

    try {
        // Letta REST supports fetching core-memory blocks
        const response = await fetch(`${LETTA_SERVER_URL}/v1/agents/${agentId}/memory`, {
            method: 'GET'
        });

        if (!response.ok) {
            // Try fallback URL /core-memory/blocks
            const fallbackResponse = await fetch(`${LETTA_SERVER_URL}/v1/agents/${agentId}/core-memory/blocks`, {
                method: 'GET'
            });
            if (!fallbackResponse.ok) {
                throw new Error(`Could not fetch memory from both /memory and /core-memory/blocks`);
            }
            return await fallbackResponse.json();
        }

        return await response.json();
    } catch (error) {
        console.error(`❌ [Letta Client] Error fetching memory:`, error.message);
        console.log(`👉 Returning simulated core memory.`);
        return {
            simulated: true,
            core_memory: {
                persona: "Name: Agent Zero\nRole: Advanced stateful orchestrator.",
                human: "User preferences: values efficiency, clean REST APIs, and elegant code."
            }
        };
    }
}

// Export functions
module.exports = {
    createLettaAgent,
    sendLettaMessage,
    getLettaAgentMemory
};

// Standalone CLI Verification Test Loop
if (require.main === module) {
    (async () => {
        console.log("=================================================");
        console.log("⚡ LETTA (MEMGPT) INTEGRATION CLI SIMULATION TEST");
        console.log("=================================================");

        // 1. Create Letta Agent
        const agent = await createLettaAgent(
            "Agent Zero Core Orchestrator", 
            "You are Agent Zero, a stateful assistant. Always respond with high precision and update your memory."
        );
        console.log("Created Agent Info:", JSON.stringify(agent, null, 2));

        // 2. Send Message to Agent
        const response = await sendLettaMessage(
            agent.id, 
            "Introduce yourself and remember that Mohit is our lead designer."
        );
        console.log("Agent Message Response:", JSON.stringify(response, null, 2));

        // 3. Fetch Memory Blocks
        const memory = await getLettaAgentMemory(agent.id);
        console.log("Agent Persistent Memory State:", JSON.stringify(memory, null, 2));

        console.log("=================================================");
        console.log("🎉 CLI TEST COMPLETED!");
        console.log("=================================================");
    })();
}
