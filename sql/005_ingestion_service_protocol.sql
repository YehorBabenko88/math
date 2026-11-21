-- Explicit generic ingestion protocol barrier. Installing this migration does
-- not activate it. This is separate from the Book queue and its closed gate.
CREATE TABLE mu_ingestion_protocol (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 mode text NOT NULL DEFAULT 'legacy' CHECK(mode IN ('legacy','fenced'))
);
INSERT INTO mu_ingestion_protocol(singleton) VALUES(true);
REVOKE ALL ON mu_ingestion_protocol FROM PUBLIC;

CREATE FUNCTION mu_ingestion_protocol_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
DECLARE protocol text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock_shared(732814,3);
 IF TG_OP='TRUNCATE' THEN
  SELECT mode INTO STRICT protocol FROM mu_ingestion_protocol WHERE singleton FOR SHARE;
  IF protocol='fenced' THEN RAISE EXCEPTION 'Fenced ingestion protocol forbids truncate'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER mu_ingestion_protocol_statement BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON mu_ingestion_jobs
FOR EACH STATEMENT EXECUTE FUNCTION mu_ingestion_protocol_lock();

CREATE FUNCTION mu_ingestion_protocol_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
DECLARE protocol text; capability text;
BEGIN
 -- Row locking also makes an old REPEATABLE READ snapshot fail serialization
 -- after activation rather than observing an obsolete legacy mode.
 SELECT mode INTO STRICT protocol FROM mu_ingestion_protocol WHERE singleton FOR SHARE;
 IF protocol='legacy' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='INSERT' AND NEW.state='queued' AND NEW.claim_token IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Fenced ingestion protocol required'; END IF;
 capability:=pg_catalog.current_setting('math_universe.claim_token',true);
 -- New acquisition or expired exhausted cleanup uses a newly minted token.
 IF OLD.state IN ('queued','running') AND (OLD.state='queued' OR OLD.lease_until<=now())
 AND capability ~ '^[a-f0-9-]{36}$' THEN
  IF NEW.state='running' AND NEW.claim_token::text=capability AND NEW.attempts=OLD.attempts+1 THEN RETURN NEW; END IF;
  IF OLD.state='running' AND OLD.attempts>=OLD.max_attempts AND NEW.state='failed'
   AND NEW.claim_token IS NULL AND NEW.worker_id IS NULL AND NEW.lease_until IS NULL THEN RETURN NEW; END IF;
 END IF;
 IF OLD.state='running' AND OLD.lease_until>now() AND OLD.claim_token IS NOT NULL AND OLD.claim_token::text=capability THEN
  IF NEW.state='running' AND NEW.claim_token=OLD.claim_token AND NEW.worker_id=OLD.worker_id THEN RETURN NEW; END IF;
  IF NEW.state IN ('completed','queued','failed') AND NEW.claim_token IS NULL AND NEW.worker_id IS NULL AND NEW.lease_until IS NULL THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Fenced ingestion protocol required';
END $$;
CREATE TRIGGER mu_ingestion_protocol_row BEFORE INSERT OR UPDATE OR DELETE ON mu_ingestion_jobs
FOR EACH ROW EXECUTE FUNCTION mu_ingestion_protocol_guard();

CREATE FUNCTION mu_enable_fenced_ingestion() RETURNS void
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
 IF pg_catalog.current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'Protocol activation requires READ COMMITTED isolation';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(732814,3);
 IF EXISTS(SELECT 1 FROM mu_ingestion_jobs WHERE state='running') THEN
  RAISE EXCEPTION 'Drain all running ingestion leases before protocol activation';
 END IF;
 UPDATE mu_ingestion_protocol SET mode='fenced' WHERE singleton;
END $$;
REVOKE ALL ON FUNCTION mu_enable_fenced_ingestion() FROM PUBLIC;
REVOKE ALL ON FUNCTION mu_ingestion_protocol_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION mu_ingestion_protocol_lock() FROM PUBLIC;

-- Status is safe for workers to read without permission to change protocol.
CREATE FUNCTION mu_ingestion_protocol_status() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path FROM CURRENT AS $$
 SELECT mode FROM mu_ingestion_protocol WHERE singleton
$$;

-- Pin every helper to catalog first and this exact trusted schema. Never use a
-- caller-controlled runtime search_path from SECURITY DEFINER trigger code.
DO $pin$
DECLARE helper text; target text:=current_schema();
BEGIN
 FOREACH helper IN ARRAY ARRAY['mu_ingestion_protocol_lock','mu_ingestion_protocol_guard','mu_enable_fenced_ingestion','mu_ingestion_protocol_status'] LOOP
  EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = pg_catalog, %I, pg_temp',target,helper,target);
 END LOOP;
END $pin$;
