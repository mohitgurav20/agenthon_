/**
 * ============================================================
 * TOOL 5: Document Reader + RAG Pipeline
 * ============================================================
 * Upload PDFs/docs → chunk into 300-word pieces → embed via
 * Gemini → store in Supabase pgvector. Agent retrieves relevant
 * chunks via similarity search.
 * 
 * Input:  { filePath: string } or { text: string }
 * Output: { chunks: [{ content, embedding, metadata }], count }
 * 
 * Works for ANY knowledge-base problem statement.
 * ============================================================
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Gemini for embeddings
function getGeminiClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Split text into ~300-word chunks with overlap
function chunkText(text, chunkSize = 300, overlapWords = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlapWords) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

// Generate embedding via Gemini
async function generateEmbedding(text) {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error(`[DocumentReader] Embedding failed: ${error.message}`);
    return null;
  }
}

// Process a document: read → chunk → embed → store in Supabase
async function processDocument(filePath, metadata = {}) {
  try {
    let text = '';

    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (['.txt', '.md', '.csv', '.json'].includes(ext)) {
      text = fs.readFileSync(filePath, 'utf-8');
    } else {
      throw new Error(`Unsupported file type: ${ext}. Supported: .pdf, .txt, .md, .csv, .json`);
    }

    return await processText(text, {
      ...metadata,
      source: path.basename(filePath),
      fileType: ext
    });

  } catch (error) {
    console.error(`[DocumentReader] Process failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Process raw text: chunk → embed → store
async function processText(text, metadata = {}) {
  try {
    const chunks = chunkText(text);
    const supabase = getSupabaseClient();
    const results = [];

    console.log(`[DocumentReader] Processing ${chunks.length} chunks...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      
      if (!embedding) continue;

      const record = {
        content: chunk,
        embedding,
        metadata: {
          ...metadata,
          chunk_index: i,
          total_chunks: chunks.length,
          word_count: chunk.split(/\s+/).length
        },
        created_at: new Date().toISOString()
      };

      // Store in Supabase knowledge_base table
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert(record)
        .select();

      if (error) {
        console.warn(`[DocumentReader] Chunk ${i} storage failed: ${error.message}`);
      } else {
        results.push(data[0]);
      }
    }

    return {
      success: true,
      chunksProcessed: chunks.length,
      chunksStored: results.length,
      source: metadata.source || 'direct_text',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Similarity search: find relevant chunks for a query
async function searchDocuments(query, topK = 5) {
  try {
    const embedding = await generateEmbedding(query);
    if (!embedding) throw new Error('Failed to generate query embedding');

    const supabase = getSupabaseClient();

    // Call Supabase RPC function for vector similarity search
    const { data, error } = await supabase
      .rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: topK
      });

    if (error) throw error;

    return {
      success: true,
      query,
      results: (data || []).map(d => ({
        content: d.content,
        similarity: d.similarity,
        metadata: d.metadata
      })),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[DocumentReader] Search failed: ${error.message}`);
    return {
      success: false,
      query,
      results: [],
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { processDocument, processText, searchDocuments, chunkText, generateEmbedding };
