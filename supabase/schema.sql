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
