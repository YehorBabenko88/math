-- Additive state for opt-in fenced ingestion workers. Existing rows remain NULL.
-- Checkpoints may contain private candidate data; retain the queue's access policy.
ALTER TABLE mu_ingestion_jobs
  ADD COLUMN IF NOT EXISTS checkpoint jsonb;
