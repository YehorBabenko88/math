-- Opt-in schema extension for per-acquisition fencing.
-- Apply with a dedicated migration role before deploying fenced workers.
ALTER TABLE mu_ingestion_jobs
  ADD COLUMN IF NOT EXISTS claim_token uuid;
CREATE INDEX IF NOT EXISTS mu_ingestion_claim_token_idx
  ON mu_ingestion_jobs (job_id, claim_token)
  WHERE state='running';
-- Existing running claims have NULL tokens and MUST be drained before
-- switching to token-required renew/complete/fail operations.
