/**
 * ============================================================
 * AGENT ZERO — ENV VARIABLES VALIDATOR
 * ============================================================
 * Strict schema validation on startup to verify all key APIs exist,
 * preventing silent crashes.
 *
 * If validation fails, it outputs a gorgeous, professional ASCII
 * error console detailing which keys are missing and how to fix it.
 * ============================================================
 */

const dotenv = require('dotenv');
const path = require('path');

// Make sure env is loaded
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const REQUIRED_KEYS = {
  GEMINI_API_KEY: {
    description: "Google Gemini API Key",
    purpose: "Powering primary deep reasoning and Flash agent synthesis."
  },
  GROQ_API_KEY: {
    description: "Groq API Key",
    purpose: "Powering ultra-fast intent routing and classification (<200ms)."
  },
  LANGFUSE_SECRET_KEY: {
    description: "Langfuse Secret Key",
    purpose: "Secret key for advanced LLM observability and evaluation."
  },
  LANGFUSE_PUBLIC_KEY: {
    description: "Langfuse Public Key",
    purpose: "Public key for tracking agent execution trees."
  },
  TAVILY_API_KEY: {
    description: "Tavily Search API Key",
    purpose: "Enables real-time fresh web search queries for workers."
  },
  SUPABASE_URL: {
    description: "Supabase Project URL",
    purpose: "Endpoint url for pgvector database, sessions, and memory storage."
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    description: "Supabase Service Role Key",
    purpose: "Grants secure write access to session tables and document vector store."
  }
};

/**
 * Print a gorgeous, modern error card to terminal
 */
function printErrorCard(errors) {
  const width = 80;
  const border = '═'.repeat(width - 2);
  
  console.error('\n');
  console.error(`╔${border}╗`);
  console.error(`║ \x1b[41m\x1b[37m  CRITICAL STARTUP ERROR: MISSING ENVIRONMENT CONFIGURATION  \x1b[0m` + ' '.repeat(width - 63) + '║');
  console.error(`╠${border}╣`);
  console.error(`║ The Agent Zero orchestrator failed to start because the following required   ║`);
  console.error(`║ environment variables are missing or misconfigured in your .env file:       ║`);
  console.error(`║` + ' '.repeat(width - 2) + '║');

  errors.forEach(err => {
    const keyStr = `  • \x1b[31m\x1b[1m${err.key}\x1b[0m: ${err.message}`;
    // Strip ANSI for length calculation
    const rawLen = `  • ${err.key}: ${err.message}`.length;
    const padding = Math.max(0, (width - 2) - rawLen);
    console.error(`║${keyStr}${' '.repeat(padding)}║`);
    
    // Print purpose in gray
    if (REQUIRED_KEYS[err.key]) {
      const purposeStr = `    \x1b[90mUsed for: ${REQUIRED_KEYS[err.key].purpose}\x1b[0m`;
      const rawPurposeLen = `    Used for: ${REQUIRED_KEYS[err.key].purpose}`.length;
      const purposePadding = Math.max(0, (width - 2) - rawPurposeLen);
      console.error(`║${purposeStr}${' '.repeat(purposePadding)}║`);
    }
    console.error(`║` + ' '.repeat(width - 2) + '║');
  });

  console.error(`╠${border}╣`);
  console.error(`║ \x1b[33mACTION REQUIRED:\x1b[0m                                                             ║`);
  console.error(`║ 1. Open / Copy the template in \x1b[36m.env.example\x1b[0m                                 ║`);
  console.error(`║ 2. Create/edit your local \x1b[36m.env\x1b[0m file inside the /agenthon_ directory        ║`);
  console.error(`║ 3. Fill in the missing API credentials and restart the orchestrator.         ║`);
  console.error(`╚${border}╝\n`);
}

function validateEnv() {
  const errors = [];

  // Try to use formal Zod validation if it is installed
  try {
    const { z } = require('zod');
    
    const envSchema = z.object({
      GEMINI_API_KEY: z.string().min(1, "API Key is required and cannot be empty"),
      GROQ_API_KEY: z.string().min(1, "API Key is required and cannot be empty"),
      LANGFUSE_SECRET_KEY: z.string().min(1, "API Key is required and cannot be empty"),
      LANGFUSE_PUBLIC_KEY: z.string().min(1, "API Key is required and cannot be empty"),
      TAVILY_API_KEY: z.string().min(1, "API Key is required and cannot be empty"),
      SUPABASE_URL: z.string().url("Must be a valid URL starting with http/https"),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "API Key is required and cannot be empty")
    });

    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      result.error.issues.forEach(issue => {
        errors.push({
          key: issue.path[0],
          message: issue.message
        });
      });
    }
  } catch (zodLoadError) {
    // Graceful fallback to pure JS validator if zod is not yet installed in node_modules
    Object.keys(REQUIRED_KEYS).forEach(key => {
      const val = process.env[key];
      if (!val || val.trim() === '' || val.includes('your_') || val.includes('placeholder')) {
        errors.push({
          key: key,
          message: "API Key is missing or contains placeholder text"
        });
      } else if (key === 'SUPABASE_URL') {
        if (!val.startsWith('http://') && !val.startsWith('https://')) {
          errors.push({
            key: key,
            message: "Must be a valid URL starting with http/https"
          });
        }
      }
    });
  }

  if (errors.length > 0) {
    printErrorCard(errors);
    process.exit(1);
  } else {
    console.log('\x1b[32m[Startup] ✓ Environment validation passed successfully.\x1b[0m');
  }
}

module.exports = { validateEnv };
