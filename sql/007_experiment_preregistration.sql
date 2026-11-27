-- DEV LAB ONLY. Explicit manual application after review; not in migration manifest.
DO $$ BEGIN
 IF current_database() <> 'math_experiment_test' OR current_setting('server_version_num')::int NOT BETWEEN 180000 AND 189999 THEN
  RAISE EXCEPTION 'LAB_ONLY';
 END IF;
 IF current_user <> 'math_experiment_owner' THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
END $$;
CREATE SCHEMA math_experiment_lab;
REVOKE ALL ON SCHEMA math_experiment_lab FROM PUBLIC;
CREATE TABLE math_experiment_lab.attempts (
 attempt_ref text PRIMARY KEY CHECK(attempt_ref ~ '^[0-9a-f]{64}$'),
 prereg_ref text NOT NULL CHECK(prereg_ref ~ '^[0-9a-f]{64}$'),
 intent_ref text NOT NULL CHECK(intent_ref ~ '^[0-9a-f]{64}$'),
 fold_ref text NOT NULL CHECK(fold_ref ~ '^[0-9a-f]{64}$'),
 ordinal bigint NOT NULL CHECK(ordinal BETWEEN 0 AND 9007199254740991),
 prereg bytea NOT NULL CHECK(octet_length(prereg) BETWEEN 2 AND 262144),
 state text NOT NULL DEFAULT 'REGISTERED' CHECK(state IN ('REGISTERED','STARTED','TERMINAL')),
 terminal bytea CHECK(octet_length(terminal) BETWEEN 2 AND 262144),
 UNIQUE(intent_ref,fold_ref,ordinal),
 CHECK((state='TERMINAL')=(terminal IS NOT NULL))
);
REVOKE ALL ON math_experiment_lab.attempts FROM PUBLIC;
CREATE FUNCTION math_experiment_lab.reserve_attempt(a text,p text,i text,f text,o bigint,b bytea)
RETURNS TABLE(attempt_ref text,prereg_ref text) LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE old math_experiment_lab.attempts%ROWTYPE;
BEGIN
 INSERT INTO math_experiment_lab.attempts(attempt_ref,prereg_ref,intent_ref,fold_ref,ordinal,prereg)
 VALUES(a,p,i,f,o,b) ON CONFLICT DO NOTHING;
 SELECT * INTO old FROM math_experiment_lab.attempts t WHERE t.attempt_ref=a FOR UPDATE;
 IF NOT FOUND OR old.prereg_ref<>p OR old.prereg<>b OR old.intent_ref<>i OR old.fold_ref<>f OR old.ordinal<>o THEN RAISE EXCEPTION 'CONFLICT'; END IF;
 RETURN QUERY SELECT a,p;
END $$;
CREATE FUNCTION math_experiment_lab.start_attempt(a text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 UPDATE math_experiment_lab.attempts SET state='STARTED' WHERE attempt_ref=a AND state='REGISTERED';
 RETURN FOUND;
END $$;
CREATE FUNCTION math_experiment_lab.finish_attempt(a text,b bytea) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE old math_experiment_lab.attempts%ROWTYPE;
BEGIN
 SELECT * INTO old FROM math_experiment_lab.attempts t WHERE t.attempt_ref=a FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UNREGISTERED'; END IF;
 IF old.state='TERMINAL' THEN
  IF old.terminal=b THEN RETURN 'REPLAY'; END IF;
  RAISE EXCEPTION 'TERMINAL_CONFLICT';
 END IF;
 IF old.state<>'STARTED' THEN RAISE EXCEPTION 'NOT_STARTED'; END IF;
 UPDATE math_experiment_lab.attempts SET state='TERMINAL',terminal=b WHERE attempt_ref=a;
 RETURN 'COMMITTED';
END $$;
REVOKE ALL ON FUNCTION math_experiment_lab.reserve_attempt(text,text,text,text,bigint,bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION math_experiment_lab.start_attempt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION math_experiment_lab.finish_attempt(text,bytea) FROM PUBLIC;
-- No role creation or grants. Deployment owner must review and explicitly provision roles.
