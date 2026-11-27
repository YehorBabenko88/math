-- Separate Scientific Memory deployment, outside the historical Math migration ledger.
CREATE TABLE IF NOT EXISTS public.mu_scientific_runs (
    id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
    symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,30}$'),
    payload text NOT NULL CHECK (octet_length(payload) BETWEEN 2 AND 8192),
    stored_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mu_scientific_runs_symbol_order
    ON public.mu_scientific_runs(symbol, stored_at DESC, id DESC);
