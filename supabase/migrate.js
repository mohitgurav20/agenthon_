/**
 * ⚡ AGENT ZERO - AUTOMATED SQL MIGRATION PIPELINE
 * 
 * Reads schema.sql and deploys all tables, extensions, indexes, and RPC 
 * functions directly to Supabase via direct PostgreSQL connection.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const schemaPath = path.resolve(__dirname, 'schema.sql');
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_TRANSACTION_POOL_URL;

async function runMigration() {
    console.log("=================================================");
    console.log("🚀 AGENT ZERO - DATABASE MIGRATION ENGINE RUNNER");
    console.log("=================================================");

    if (!connectionString || connectionString.includes('[PASSWORD]') || connectionString.includes('YOUR_DB_PASSWORD')) {
        console.warn("⚠️  [Migration Engine] DATABASE_URL is not set or contains placeholders.");
        console.warn("👉 To run live SQL migrations, configure direct DB access in .env:");
        console.warn("   DATABASE_URL=postgresql://postgres.igmpeciekhaczkagnqin:<password>@aws-0-us-east-1.pooler.supabase.co:5432/postgres");
        console.warn("\n👉 Skipping live migration. Falling back to Mock Schema confirmation.");
        console.log("=================================================");
        return true;
    }

    console.log(`Connecting to database at: ${connectionString.split('@')[1]}...`);
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase external SSL connections
    });

    try {
        await client.connect();
        console.log("✅ Successfully connected to Supabase PostgreSQL database.");

        console.log("Reading schema.sql...");
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log("Executing database schema queries...");
        // Split queries by semicolon to execute them sequentially
        // Note: We need to ignore semicolons inside PL/pgSQL $$ blocks
        const statements = sql
            .split(/;(?=(?:[^$]*\$\$[^$]*\$\$)*[^$]*$)/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            const snippet = statement.substring(0, 50).replace(/\n/g, ' ') + "...";
            console.log(`Executing statement: "${snippet}"`);
            await client.query(statement);
        }

        console.log("\n🎉 ALL DATABASE SCHEMAS & RRF HYBRID SEARCH RPC APPLIED SUCCESSFULLY!");
        console.log("=================================================");
        return true;
    } catch (error) {
        console.error("\n❌ MIGRATION FAILED:", error.message);
        console.log("=================================================");
        throw error;
    } finally {
        await client.end();
    }
}

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runMigration };
