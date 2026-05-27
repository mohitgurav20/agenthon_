require('dotenv').config();
const { Pool } = require('pg');

/**
 * ⚡ AGENT ZERO - DATABASE CONNECTION POOL
 * 
 * Optimized PostgreSQL connection pool using pg.Pool.
 * Ideal for high-concurrency connections via Supabase PgBouncer.
 */

// We typically use the transaction connection pooler string (port 6543) for PgBouncer
// Fallback to standard SUPABASE_URL parsing if needed, but it's best to have a true connection string.
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_CONNECTION_STRING;

let pool;

if (connectionString) {
    pool = new Pool({
        connectionString,
        max: 10, // Max number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection could not be established
    });

    pool.on('error', (err, client) => {
        console.error('❌ [DB Pool] Unexpected error on idle client', err);
    });

    console.log('✅ [DB Pool] Connection pool initialized.');
} else {
    console.warn('⚠️ [DB Pool] DATABASE_URL not provided. Pool not initialized. (Set this for high-concurrency ops)');
}

/**
 * Executes a parameterized SQL query using the connection pool.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Result object containing rows and rowCount
 */
async function executeQuery(text, params = []) {
    if (!pool) {
        throw new Error("Database pool is not initialized. Check DATABASE_URL.");
    }
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`[DB Pool] Executed query in ${duration}ms (Rows: ${res.rowCount})`);
        return res;
    } catch (err) {
        console.error(`❌ [DB Pool] Query execution error:`, err.message);
        throw err;
    }
}

/**
 * Checks the current health and metrics of the database connection pool.
 * @returns {Object} Health metrics
 */
function checkPoolHealth() {
    if (!pool) {
        return { status: 'not_configured', message: 'Connection pool not initialized.' };
    }
    return {
        status: 'healthy',
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
}

/**
 * Gracefully shuts down the connection pool, waiting for active queries to complete.
 */
async function shutdownPool() {
    if (pool) {
        console.log('🛑 [DB Pool] Draining and shutting down connection pool...');
        try {
            await pool.end();
            console.log('✅ [DB Pool] Pool shutdown complete.');
        } catch (err) {
            console.error('❌ [DB Pool] Error during pool shutdown:', err.message);
        }
    }
}

module.exports = {
    pool,
    executeQuery,
    checkPoolHealth,
    shutdownPool
};
