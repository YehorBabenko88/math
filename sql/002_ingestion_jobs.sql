-- Standalone scientific ingestion job queue. Dedicated Math Universe database only.
BEGIN;
CREATE TABLE IF NOT EXISTS mu_ingestion_jobs (
 job_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 idempotency_key char(64) NOT NULL UNIQUE CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
 kind text NOT NULL CHECK (kind IN ('extract-pages','analyze-knowledge','propose-adapter','verify-candidate')),
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','completed','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 worker_id text,
 result jsonb,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mu_ingestion_claim_idx ON mu_ingestion_jobs (state,available_at,job_id);
COMMIT;
