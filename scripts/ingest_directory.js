/**
 * ⚡ AGENT ZERO - RECURSIVE DIRECTORY DOCUMENT INGESTION CLI TOOL
 * 
 * Scans directories for .md/.txt/.json files, parses and chunks them into 
 * overlapping 300-word blocks, embeds via Gemini, and batch-inserts 
 * them into the Supabase documents table in parallel.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Initialize API clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Helper to recursively find all files in a directory matching extensions
 */
function getFilesRecursively(dir, extensions = ['.md', '.txt', '.json']) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (item.name === 'node_modules' || item.name === '.git' || item.name === 'memory') continue;
            files = [...files, ...getFilesRecursively(fullPath, extensions)];
        } else if (item.isFile()) {
            // Ignore lock files, extremely large files, and auto-generated logs
            const stats = fs.statSync(fullPath);
            const isTooLarge = stats.size > 50000; // Ignore files > 50KB to protect tokens
            const isLockFile = item.name.includes('lock') || item.name === 'api.json';
            
            if (extensions.includes(path.extname(item.name).toLowerCase()) && !isTooLarge && !isLockFile) {
                files.push(fullPath);
            }
        }
    }
    return files;
}

/**
 * Chunks content into overlapping text blocks
 */
function chunkText(text, chunkSize = 300, overlap = 50) {
    const words = text.split(/\s+/);
    const chunks = [];
    
    if (words.length <= chunkSize) {
        return [text];
    }
    
    let i = 0;
    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        chunks.push(chunk);
        i += (chunkSize - overlap);
    }
    return chunks;
}

/**
 * Ingests a single file
 */
async function ingestFile(filePath) {
    console.log(`\n📄 [Ingest CLI] Processing: ${path.basename(filePath)}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const chunks = chunkText(content);
    
    console.log(`👉 Split into ${chunks.length} chunks. Generating embeddings...`);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-embedding-2",
        systemInstruction: "This model is used exclusively for generating text embeddings."
    });

    let successCount = 0;

    for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        try {
            // Enforce free-tier rate limit delay (15 RPM limits)
            if (index > 0) {
                console.log("Sleeping 4.5s to preserve API quota rate limits...");
                await new Promise(r => setTimeout(r, 4500));
            }

            // Generate Gemini Embedding
            const embeddingResult = await model.embedContent(chunk);
            const embedding = embeddingResult.embedding.values;

            // Save to Supabase
            const { error } = await supabase
                .from('documents')
                .insert([
                    {
                        content: chunk,
                        embedding: embedding,
                        metadata: {
                            source: path.basename(filePath),
                            full_path: filePath,
                            chunk_index: index,
                            total_chunks: chunks.length
                        }
                    }
                ]);

            if (error) throw error;
            successCount++;
        } catch (e) {
            console.error(`❌ Failed to ingest chunk #${index}:`, e.message);
        }
    }
    
    console.log(`✅ File complete: ${successCount}/${chunks.length} chunks successfully saved.`);
    return successCount;
}

/**
 * Scans and ingests an entire directory
 */
async function ingestDirectory(dirPath) {
    console.log("=================================================");
    console.log("⚡ AGENT ZERO - RECURSIVE DIRECTORY DOCUMENT INGEST");
    console.log("=================================================");
    console.log(`Scanning target directory: ${dirPath}...`);

    const files = getFilesRecursively(dirPath);
    console.log(`Found ${files.length} documents matching md/txt/json extensions.`);

    if (files.length === 0) {
        console.log("No documents found to ingest.");
        console.log("=================================================");
        return;
    }

    let totalSaved = 0;
    const startTime = Date.now();

    for (const file of files) {
        try {
            const count = await ingestFile(file);
            totalSaved += count;
        } catch (e) {
            console.error(`❌ Error processing file ${file}:`, e.message);
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log("\n=================================================");
    console.log("🎉 INGESTION RUN COMPLETED!");
    console.log(`- Total Files Processed: ${files.length}`);
    console.log(`- Total Vector Chunks Ingested: ${totalSaved}`);
    console.log(`- Total Duration: ${duration.toFixed(1)} seconds`);
    console.log("=================================================");
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const targetDir = args[0] || path.join(__dirname, '../scripts'); // Default scan own script directory as test
    ingestDirectory(targetDir);
}

module.exports = { ingestDirectory };
