WITH ranked_entries AS (
  SELECT id, row_number() OVER (PARTITION BY domain ORDER BY created_at DESC, id DESC) AS row_num
  FROM public.audit_entries
)
DELETE FROM public.audit_entries
WHERE id IN (
  SELECT id FROM ranked_entries WHERE row_num > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_entries_domain_key'
      AND conrelid = 'public.audit_entries'::regclass
  ) THEN
    ALTER TABLE public.audit_entries
    ADD CONSTRAINT audit_entries_domain_key UNIQUE (domain);
  END IF;
END $$;
