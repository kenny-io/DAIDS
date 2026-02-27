-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/pqtxsjkfggaxtgpsxpri/sql)
-- This creates all tables and constraints needed for the DAIDS analytics store.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main audit entries table (one row per domain, upserted on re-audit)
CREATE TABLE IF NOT EXISTS public.audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  domain text NOT NULL,
  score integer NOT NULL,
  crawled_pages integer NOT NULL,
  category_scores jsonb NOT NULL,
  duration_ms integer NOT NULL,
  error_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Full audit result JSON (linked to entry)
CREATE TABLE IF NOT EXISTS public.audit_results (
  entry_id uuid PRIMARY KEY REFERENCES public.audit_entries(id) ON DELETE CASCADE,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS audit_entries_created_at_idx ON public.audit_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entries_score_created_at_idx ON public.audit_entries (score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entries_domain_idx ON public.audit_entries (domain);

-- Enforce one entry per domain (de-duplicate before adding constraint)
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY domain ORDER BY created_at DESC, id DESC) AS rn
  FROM public.audit_entries
)
DELETE FROM public.audit_entries WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_entries_domain_key'
      AND conrelid = 'public.audit_entries'::regclass
  ) THEN
    ALTER TABLE public.audit_entries ADD CONSTRAINT audit_entries_domain_key UNIQUE (domain);
  END IF;
END $$;

-- Grant schema and table access to Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.audit_entries TO service_role;
GRANT ALL ON public.audit_results TO service_role;
GRANT SELECT ON public.audit_entries TO anon, authenticated;
GRANT SELECT ON public.audit_results TO anon, authenticated;
