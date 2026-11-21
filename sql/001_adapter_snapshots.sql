-- Math Universe standalone adapter store, v1.
-- Run in a dedicated database using a dedicated least-privileged role.
-- Do not connect this schema to Cluster Grid.
BEGIN;
CREATE TABLE IF NOT EXISTS mu_adapter_snapshots (
  snapshot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_version text NOT NULL CHECK (schema_version = 'math-universe-adapter-registry/v1'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sha256)
);
CREATE INDEX IF NOT EXISTS mu_adapter_snapshots_created_idx ON mu_adapter_snapshots (created_at DESC, snapshot_id DESC);
COMMIT;
