-- Additive correction: preserve historical migration bytes and protocol mode.
-- Row triggers run after the job row lock; sample wall time after protocol lock.
-- Drain transactions executing the old guard before installing its replacement.
SELECT pg_catalog.pg_advisory_xact_lock(732814,3);
CREATE OR REPLACE FUNCTION mu_ingestion_protocol_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
DECLARE protocol text; capability text; checked_at timestamptz;
BEGIN
 -- Row locking also makes an old REPEATABLE READ snapshot fail serialization
 -- after activation rather than observing an obsolete legacy mode.
 SELECT mode INTO STRICT protocol FROM mu_ingestion_protocol WHERE singleton FOR SHARE;
 -- Capture only AFTER the protocol row lock (which can itself wait).
 checked_at:=pg_catalog.clock_timestamp();
 IF protocol='legacy' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW.state='queued' AND NEW.claim_token IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Fenced ingestion protocol required'; END IF;
 capability:=pg_catalog.current_setting('math_universe.claim_token',true);
 -- New acquisition or expired exhausted cleanup uses a newly minted token.
 IF OLD.state IN ('queued','running') AND (OLD.state='queued' OR OLD.lease_until<=checked_at)
 AND capability ~ '^[a-f0-9-]{36}$' THEN
  IF NEW.state='running' AND NEW.claim_token::text=capability AND NEW.attempts=OLD.attempts+1 AND NEW.lease_until>checked_at THEN RETURN NEW; END IF;
  IF OLD.state='running' AND OLD.attempts>=OLD.max_attempts AND NEW.state='failed'
   AND NEW.claim_token IS NULL AND NEW.worker_id IS NULL AND NEW.lease_until IS NULL THEN RETURN NEW; END IF;
 END IF;
 IF OLD.state='running' AND OLD.lease_until>checked_at AND OLD.claim_token IS NOT NULL AND OLD.claim_token::text=capability THEN
  IF NEW.state='running' AND NEW.claim_token=OLD.claim_token AND NEW.worker_id=OLD.worker_id AND NEW.lease_until>checked_at THEN RETURN NEW; END IF;
  IF NEW.state IN ('completed','queued','failed') AND NEW.claim_token IS NULL AND NEW.worker_id IS NULL AND NEW.lease_until IS NULL THEN RETURN NEW; END IF;
 END IF;
 IF OLD.state='running' AND OLD.claim_token::text=capability AND OLD.lease_until<=checked_at THEN
  RAISE EXCEPTION 'Job lease expired or not owned' USING ERRCODE='MU001';
 END IF;
 RAISE EXCEPTION 'Fenced ingestion protocol required';
END $$;
REVOKE ALL ON FUNCTION mu_ingestion_protocol_guard() FROM PUBLIC;
DO $pin$
BEGIN
 EXECUTE format('ALTER FUNCTION %I.mu_ingestion_protocol_guard() SET search_path = pg_catalog, %I, pg_temp',current_schema(),current_schema());
END $pin$;
