CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS public.audit_results (
  entry_id uuid PRIMARY KEY REFERENCES public.audit_entries(id) ON DELETE CASCADE,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_entries_created_at_idx ON public.audit_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entries_score_created_at_idx ON public.audit_entries (score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_entries_domain_idx ON public.audit_entries (domain);
