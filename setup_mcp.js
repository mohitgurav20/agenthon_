const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
const envConfig = dotenv.config().parsed;

if (!envConfig) {
  console.error("No .env file found. Please create one with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and MEM0_API_KEY");
  process.exit(1);
}

const mcpConfigPath = path.join(__dirname, 'mcp_config.json');

try {
  let mcpConfigStr = fs.readFileSync(mcpConfigPath, 'utf8');
  
  // Replace placeholders with actual values
  if (envConfig.SUPABASE_URL) {
    mcpConfigStr = mcpConfigStr.replace(/<YOUR_SUPABASE_URL>/g, envConfig.SUPABASE_URL);
  }
  if (envConfig.SUPABASE_SERVICE_ROLE_KEY) {
    mcpConfigStr = mcpConfigStr.replace(/<YOUR_SUPABASE_SERVICE_ROLE_KEY>/g, envConfig.SUPABASE_SERVICE_ROLE_KEY);
  }
  if (envConfig.MEM0_API_KEY) {
    mcpConfigStr = mcpConfigStr.replace(/<YOUR_MEM0_API_KEY>/g, envConfig.MEM0_API_KEY);
  }

  fs.writeFileSync(mcpConfigPath, mcpConfigStr);
  console.log("Successfully injected .env variables into mcp_config.json!");
} catch (error) {
  console.error("Error updating mcp_config.json:", error);
}
