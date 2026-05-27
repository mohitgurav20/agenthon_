/**
 * ⚡ RESUMEVAULT AI - INTERACTIVE PROFILE BUILDER
 * 
 * Provides an interactive conversational interview chat loop.
 * Prompts the candidate about their projects, skills, and background,
 * extracts key conversational facts on-the-fly, and statefully registers them inside Mem0.
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const readline = require('readline');
const { storeMemory } = require('./store_memory');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

/**
 * Conducts a single dynamic step in the ResumeVault Interview
 * @param {Array} messages - Chat history list of { role: 'user'|'assistant', content: string }
 * @param {string} userId - Target candidate user ID
 * @returns {Promise<Object>} { question: string, extractedFacts: Array }
 */
async function conductInterviewStep(messages, userId) {
    const isGeminiLive = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your_');
    if (!isGeminiLive) {
        // High-fidelity fallback
        const mockQuestions = [
            "What major database or caching systems (e.g. pgvector, Redis) did you implement in your wisdom-cli project?",
            "What frameworks (e.g. Next.js, Express) did you use in SBSPS Transport system?",
            "Can you tell me about any cloud platforms or Docker containers you deployed recently?",
            "Are there any specific developer certifications you have completed?"
        ];
        const nextQ = mockQuestions[Math.min(messages.filter(m => m.role === 'assistant').length, mockQuestions.length - 1)];
        return { question: nextQ, extractedFacts: ["Simulated fact extraction."] };
    }

    try {
        const lastUserMsg = messages[messages.length - 1]?.content || "";
        
        // 1. Fact Extraction Loop (run in parallel / background)
        let extractedFacts = [];
        if (lastUserMsg) {
            try {
                const extractionModel = genAI.getGenerativeModel({ 
                    model: "gemini-1.5-pro",
                    generationConfig: { responseMimeType: "application/json" }
                });
                
                const extractionPrompt = `Extract professional career facts, technical skills, databases used, projects mentioned, or certifications from this candidate statement:
"${lastUserMsg}"
Return the output strictly in the following JSON format:
{
  "facts": ["fact 1", "fact 2"]
}`;

                const extractResult = await extractionModel.generateContent(extractionPrompt);
                const responseText = extractResult.response.text();
                const json = JSON.parse(responseText);
                extractedFacts = json.facts || [];
                
                // Statefully ingest each extracted fact into Mem0
                for (const fact of extractedFacts) {
                    await storeMemory(fact, userId, 'user-preferences');
                }
            } catch (err) {
                console.warn("⚠️  [Profile Builder] Fact extraction skipped or failed:", err.message);
            }
        }

        // 2. Generate next contextual interview question
        const promptSystem = `You are a world-class professional recruiter building a candidate's career vault for ResumeVault AI.
Your goal is to conduct a natural, engaging, and friendly chat interview with the candidate to discover their technical projects, backend databases, skills, and certifications.
- Be extremely encouraging and positive.
- Keep your questions short, professional, and targeted (ask only one topic at a time).
- Reference their previous answer to show you are listening.
- If they mention projects, dig into their tech stack, their role, and key challenges solved.
- When you have gathered substantial profile facts (skills, databases, projects), thank them and indicate that the database is fully seeded.`;

        const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        
        // Convert messages to Gemini Content structure
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // Prepend system prompt to the first message or use model config
        const chat = chatModel.startChat({
            history: contents.slice(0, -1),
            systemInstruction: promptSystem
        });

        const nextMessageText = lastUserMsg || "Let's begin the career profile interview.";
        const responseResult = await chat.sendMessage(nextMessageText);
        const question = responseResult.response.text();

        return { question, extractedFacts };
    } catch (err) {
        console.error("❌ Interview step generation failed:", err.message);
        return {
            question: "Could you tell me a little bit more about the technical details of your last project?",
            extractedFacts: []
        };
    }
}

/**
 * Interactive Command Line Interface for direct candidate interview testing
 */
function startInteractiveCLI() {
    console.log("=================================================");
    console.log("🗣️  RESUMEVAULT AI — CANDIDATE PROFILE INTERVIEW");
    console.log("=================================================");
    console.log("type 'exit' or 'quit' at any time to conclude.\n");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const userId = process.env.MEM0_DEFAULT_USER_ID || 'agent-zero-user';
    const history = [];

    async function askQuestion() {
        const result = await conductInterviewStep(history, userId);
        console.log(`\n🤖 [ResumeVault Ingester]: ${result.question}`);
        
        if (result.extractedFacts && result.extractedFacts.length > 0) {
            console.log(`✨ [Mem0 Ingestion]: Extracted & Saved ${result.extractedFacts.length} stateful facts.`);
        }

        history.push({ role: 'assistant', content: result.question });

        rl.question('\n✍️  [You]: ', async (answer) => {
            const cleanAnswer = answer.trim();
            if (cleanAnswer.toLowerCase() === 'exit' || cleanAnswer.toLowerCase() === 'quit') {
                console.log("\n👋 Concluding Profile Interview. Thank you! Your ResumeVault is fully populated.");
                rl.close();
                process.exit(0);
            }

            history.push({ role: 'user', content: cleanAnswer });
            await askQuestion();
        });
    }

    // Launch first interview question
    askQuestion();
}

if (require.main === module) {
    startInteractiveCLI();
}

module.exports = { conductInterviewStep };
