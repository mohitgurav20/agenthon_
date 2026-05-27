-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    email TEXT,
    preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT,
    metadata JSONB
);

-- Create generic table for tool execution logs (from Action Agent)
CREATE TABLE IF NOT EXISTS tool_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    tool_name TEXT NOT NULL,
    input JSONB,
    output JSONB,
    latency_ms INT,
    status TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generic table for agent outputs (Orchestrator/Worker Agents)
CREATE TABLE IF NOT EXISTS agent_outputs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    agent_name TEXT NOT NULL,
    input JSONB,
    output JSONB NOT NULL,
    confidence FLOAT,
    tools_used JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generic table for RAG documents (Supabase pgvector)
CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(3072), -- Gemini Embedding 2 is 3072 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding VECTOR(3072),
    match_threshold FLOAT,
    match_count INT
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Create Full-Text Search GIN index for hybrid BM25 searches
CREATE INDEX IF NOT EXISTS documents_fts_idx ON documents USING GIN (to_tsvector('english', content));

-- Create RRF Hybrid Search SQL similarity search function
CREATE OR REPLACE FUNCTION match_documents_hybrid (
    query_text TEXT,
    query_embedding VECTOR(3072),
    match_threshold FLOAT,
    match_count INT,
    rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    rrf_score FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT 
            d.id,
            d.content,
            d.metadata,
            (1 - (d.embedding <=> query_embedding)) AS similarity,
            ROW_NUMBER() OVER (ORDER BY d.embedding <=> query_embedding) AS rank
        FROM documents d
        WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
    ),
    keyword_search AS (
        SELECT 
            d.id,
            d.content,
            d.metadata,
            ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', query_text)) AS keyword_score,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', query_text)) DESC) AS rank
        FROM documents d
        WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        COALESCE(s.id, k.id) AS id,
        COALESCE(s.content, k.content) AS content,
        COALESCE(s.metadata, k.metadata) AS metadata,
        COALESCE(s.similarity, 0.0)::FLOAT AS similarity,
        (
            COALESCE(1.0 / (rrf_k + s.rank), 0.0) +
            COALESCE(1.0 / (rrf_k + k.rank), 0.0)
        )::FLOAT AS rrf_score
    FROM semantic_search s
    FULL OUTER JOIN keyword_search k ON s.id = k.id
    ORDER BY rrf_score DESC
    LIMIT match_count;
END;
$$;
