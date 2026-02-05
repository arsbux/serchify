-- E-Commerce SEO Tool - Database Schema
-- Run this in your Supabase SQL Editor
--
-- ⚠️ WARNING: RLS is disabled for easier development
-- For production, enable RLS and implement proper row-level security policies

-- Simplified schema for 12-hour MVP
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.keyword_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    search_volume INTEGER,
    competition TEXT,
    results JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.page_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    seo_score INTEGER,
    issues JSONB,
    suggestions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS (Row Level Security) for development
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_searches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_analyses DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to anon role (authenticated users via Supabase)
GRANT ALL ON public.profiles TO anon;
GRANT ALL ON public.keyword_searches TO anon;
GRANT ALL ON public.page_analyses TO anon;

-- Grant usage on sequences (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_keyword_searches_user_id ON public.keyword_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_keyword_searches_created_at ON public.keyword_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_analyses_user_id ON public.page_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_page_analyses_created_at ON public.page_analyses(created_at DESC);
