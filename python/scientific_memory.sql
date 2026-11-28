-- Separate Scientific Memory deployment, outside the historical Math migration ledger.
CREATE TABLE IF NOT EXISTS public.mu_scientific_runs (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
    symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,30}$'),
    payload text NOT NULL CHECK (octet_length(payload) BETWEEN 2 AND 8192),
    stored_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mu_scientific_runs_symbol_order
    ON public.mu_scientific_runs(symbol, stored_at DESC, id DESC);
-- Ordinary SQL clients cannot rewrite scientific history. Database owners and
-- superusers remain a trusted administration boundary (they can disable DDL).
CREATE OR REPLACE FUNCTION public.mu_scientific_runs_deny_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'scientific memory is append-only' USING ERRCODE = '55000';
END;
$$;
DROP TRIGGER IF EXISTS mu_scientific_runs_immutable ON public.mu_scientific_runs;
CREATE TRIGGER mu_scientific_runs_immutable
    BEFORE UPDATE OR DELETE OR TRUNCATE ON public.mu_scientific_runs
    FOR EACH STATEMENT EXECUTE FUNCTION public.mu_scientific_runs_deny_mutation();
