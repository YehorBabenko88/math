-- Disposable lab draft only; not in the migration manifest.
DO $$ BEGIN
 IF current_database() <> 'math_experiment_test' OR current_setting('server_version_num')::int NOT BETWEEN 180000 AND 189999 OR current_user <> 'math_experiment_owner' THEN RAISE EXCEPTION 'LAB_ONLY'; END IF;
END $$;
CREATE SCHEMA math_experiment_lab;
REVOKE ALL ON SCHEMA math_experiment_lab FROM PUBLIC;
CREATE DOMAIN math_experiment_lab.ref AS text CHECK(VALUE ~ '^[0-9a-f]{64}$');
CREATE TABLE math_experiment_lab.budgets (
 policy_ref math_experiment_lab.ref PRIMARY KEY,
 proposal_limit bigint NOT NULL CHECK(proposal_limit>=0),
 attempt_limit bigint NOT NULL CHECK(attempt_limit>=0),
 proposals bigint NOT NULL DEFAULT 0 CHECK(proposals BETWEEN 0 AND proposal_limit),
 attempts bigint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND attempt_limit)
);
CREATE TABLE math_experiment_lab.attempts (
 attempt_ref math_experiment_lab.ref PRIMARY KEY,
 prereg_ref math_experiment_lab.ref NOT NULL,
 intent_ref math_experiment_lab.ref NOT NULL,
 fold_ref math_experiment_lab.ref NOT NULL,
 ordinal bigint NOT NULL CHECK(ordinal BETWEEN 0 AND 9007199254740991),
 budget_ref math_experiment_lab.ref NOT NULL REFERENCES math_experiment_lab.budgets,
 semantic_ref math_experiment_lab.ref NOT NULL UNIQUE,
 semantic_binding bytea NOT NULL CHECK(octet_length(semantic_binding) BETWEEN 2 AND 262144),
 prereg bytea NOT NULL CHECK(octet_length(prereg) BETWEEN 2 AND 262144),
 state text NOT NULL DEFAULT 'REGISTERED' CHECK(state IN ('REGISTERED','CLAIMED','STARTED','TERMINAL')),
 worker_ref math_experiment_lab.ref,
 token uuid,
 terminal bytea CHECK(octet_length(terminal) BETWEEN 2 AND 262144),
 UNIQUE(intent_ref,fold_ref,ordinal),
 CHECK((state='REGISTERED')=(worker_ref IS NULL)),
 CHECK((worker_ref IS NULL)=(token IS NULL)),
 CHECK((state='TERMINAL')=(terminal IS NOT NULL))
);
CREATE TABLE math_experiment_lab.commands (
 command_ref math_experiment_lab.ref PRIMARY KEY,
 op text NOT NULL,
 binding bytea NOT NULL CHECK(octet_length(binding) BETWEEN 1 AND 262144),
 outcome text NOT NULL,
 attempt_ref math_experiment_lab.ref NOT NULL REFERENCES math_experiment_lab.attempts
);
REVOKE ALL ON ALL TABLES IN SCHEMA math_experiment_lab FROM PUBLIC;
-- Serialize command IDs before other row locks. Hash collision only adds contention.
CREATE FUNCTION math_experiment_lab.check_command(c text,o text,b bytea) RETURNS text LANGUAGE plpgsql
SET search_path=pg_catalog,pg_temp AS $$
DECLARE old math_experiment_lab.commands%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(c,91817));
 SELECT * INTO old FROM math_experiment_lab.commands WHERE command_ref=c;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF old.op<>o OR old.binding<>b THEN RAISE EXCEPTION 'COMMAND_CONFLICT'; END IF;
 RETURN old.outcome;
END $$;
CREATE FUNCTION math_experiment_lab.reserve_attempt(c text,a text,p text,i text,f text,o bigint,k text,b bytea,s text,sb bytea)
RETURNS TABLE(attempt_ref text,prereg_ref text,outcome text) LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE old math_experiment_lab.attempts%ROWTYPE; prior text; result text; binding bytea;
BEGIN
 binding=convert_to(concat_ws(':',a,p,i,f,o,k,s),'UTF8')||int4send(octet_length(b))||b||sb;
 prior=math_experiment_lab.check_command(c,'reserve',binding);
 IF prior IS NOT NULL THEN
  RETURN QUERY SELECT t.attempt_ref::text,t.prereg_ref::text,prior FROM math_experiment_lab.commands q JOIN math_experiment_lab.attempts t ON t.attempt_ref=q.attempt_ref WHERE q.command_ref=c;
  RETURN;
 END IF;
 UPDATE math_experiment_lab.budgets SET proposals=proposals+1 WHERE policy_ref=k AND proposals<proposal_limit;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROPOSAL_BUDGET'; END IF;
 INSERT INTO math_experiment_lab.attempts(attempt_ref,prereg_ref,intent_ref,fold_ref,ordinal,budget_ref,prereg,semantic_ref,semantic_binding)
 VALUES(a,p,i,f,o,k,b,s,sb) ON CONFLICT DO NOTHING;
 IF FOUND THEN
  UPDATE math_experiment_lab.budgets SET attempts=attempts+1 WHERE policy_ref=k AND attempts<attempt_limit;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTEMPT_BUDGET'; END IF;
  result='REGISTERED';
 ELSE
  SELECT * INTO old FROM math_experiment_lab.attempts t WHERE t.attempt_ref=a FOR UPDATE;
  IF FOUND THEN
   IF old.prereg_ref<>p OR old.prereg<>b OR old.intent_ref<>i OR old.fold_ref<>f OR old.ordinal<>o OR old.budget_ref<>k OR old.semantic_ref<>s OR old.semantic_binding<>sb THEN RAISE EXCEPTION 'CONFLICT'; END IF;
  ELSE
   SELECT * INTO old FROM math_experiment_lab.attempts t WHERE t.semantic_ref=s FOR UPDATE;
   IF NOT FOUND OR old.semantic_binding<>sb OR old.budget_ref<>k THEN RAISE EXCEPTION 'SEMANTIC_CONFLICT'; END IF;
  END IF;
  result='DUPLICATE';
 END IF;
 IF result='REGISTERED' THEN SELECT * INTO old FROM math_experiment_lab.attempts t WHERE t.attempt_ref=a; END IF;
 INSERT INTO math_experiment_lab.commands VALUES(c,'reserve',binding,result,old.attempt_ref);
 RETURN QUERY SELECT old.attempt_ref::text,old.prereg_ref::text,result;
END $$;
-- Reuse the policy's proposal admission credit for every new command receipt.
-- This lock precedes the attempt lock, matching reservation lock order.
CREATE FUNCTION math_experiment_lab.admit_command(a text,credits bigint DEFAULT 1) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 UPDATE math_experiment_lab.budgets SET proposals=proposals+credits
 WHERE policy_ref=(SELECT budget_ref FROM math_experiment_lab.attempts WHERE attempt_ref=a)
 AND credits BETWEEN 1 AND 2 AND proposals<=proposal_limit-credits;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMAND_BUDGET'; END IF;
END $$;
CREATE FUNCTION math_experiment_lab.claim_attempt(c text,a text,w text,t uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE b bytea; fresh boolean;
BEGIN
 b=convert_to(a||':'||w,'UTF8');
 IF math_experiment_lab.check_command(c,'claim',b) IS NOT NULL THEN RETURN false; END IF;
 PERFORM math_experiment_lab.admit_command(a);
 UPDATE math_experiment_lab.attempts SET state='CLAIMED',worker_ref=w,token=t WHERE attempt_ref=a AND state='REGISTERED';
 fresh=FOUND;
 INSERT INTO math_experiment_lab.commands VALUES(c,'claim',b,CASE WHEN fresh THEN 'CLAIMED' ELSE 'REFUSED' END,a);
 RETURN fresh;
END $$;
CREATE FUNCTION math_experiment_lab.start_attempt(c text,a text,w text,t uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE b bytea; fresh boolean;
BEGIN
 b=convert_to(a||':'||w||':'||t::text,'UTF8');
 IF math_experiment_lab.check_command(c,'start',b) IS NOT NULL THEN RETURN false; END IF;
 -- Reserve before start; refused starts consume one credit, successful starts two.
 PERFORM math_experiment_lab.admit_command(a);
 UPDATE math_experiment_lab.attempts SET state='STARTED' WHERE attempt_ref=a AND state='CLAIMED' AND worker_ref=w AND token=t;
 fresh=FOUND;
 IF fresh THEN PERFORM math_experiment_lab.admit_command(a); END IF;
 INSERT INTO math_experiment_lab.commands VALUES(c,'start',b,CASE WHEN fresh THEN 'STARTED' ELSE 'REFUSED' END,a);
 RETURN fresh;
END $$;
CREATE FUNCTION math_experiment_lab.finish_attempt(c text,a text,w text,t uuid,b bytea) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE old math_experiment_lab.attempts%ROWTYPE; binding bytea; prior text; result text;
BEGIN
 binding=convert_to(a||':'||w||':'||t::text,'UTF8')||b;
 prior=math_experiment_lab.check_command(c,'finish',binding);
 IF prior IS NOT NULL THEN RETURN 'REPLAY'; END IF;
 -- The successful START reserved the terminal credit. Lock only this attempt.
 SELECT * INTO old FROM math_experiment_lab.attempts WHERE attempt_ref=a FOR UPDATE;
 IF NOT FOUND OR old.worker_ref IS DISTINCT FROM w OR old.token IS DISTINCT FROM t THEN RAISE EXCEPTION 'CLAIM_MISMATCH'; END IF;
 IF old.state='TERMINAL' THEN
  IF old.terminal<>b THEN RAISE EXCEPTION 'TERMINAL_CONFLICT'; END IF;
  RETURN 'REPLAY';
 ELSIF old.state='STARTED' THEN
  UPDATE math_experiment_lab.attempts SET state='TERMINAL',terminal=b WHERE attempt_ref=a;
  result='COMMITTED';
 ELSE RAISE EXCEPTION 'NOT_STARTED';
 END IF;
 INSERT INTO math_experiment_lab.commands VALUES(c,'finish',binding,result,a);
 RETURN result;
END $$;
CREATE FUNCTION math_experiment_lab.lookup_command(c text) RETURNS TABLE(op text,outcome text,attempt_ref text,prereg_ref text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
 SELECT q.op,q.outcome,t.attempt_ref::text,t.prereg_ref::text FROM math_experiment_lab.commands q JOIN math_experiment_lab.attempts t ON t.attempt_ref=q.attempt_ref WHERE q.command_ref=c
$$;
CREATE FUNCTION math_experiment_lab.lookup_status(a text) RETURNS TABLE(attempt_ref text,state text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $
 SELECT t.attempt_ref::text,t.state FROM math_experiment_lab.attempts t WHERE t.attempt_ref=a
$;
-- Even the provisioning owner cannot silently rewrite the preregistration or budget policy.
CREATE FUNCTION math_experiment_lab.guard_immutable() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'IMMUTABLE'; END IF;
 IF TG_TABLE_NAME='budgets' THEN
  IF (NEW.policy_ref,NEW.proposal_limit,NEW.attempt_limit) IS DISTINCT FROM (OLD.policy_ref,OLD.proposal_limit,OLD.attempt_limit) OR NEW.proposals<OLD.proposals OR NEW.attempts<OLD.attempts THEN RAISE EXCEPTION 'IMMUTABLE_BUDGET'; END IF;
 ELSIF TG_TABLE_NAME='commands' THEN RAISE EXCEPTION 'IMMUTABLE_RECEIPT';
 ELSE
  IF (NEW.attempt_ref,NEW.prereg_ref,NEW.intent_ref,NEW.fold_ref,NEW.ordinal,NEW.budget_ref,NEW.semantic_ref,NEW.semantic_binding,NEW.prereg) IS DISTINCT FROM (OLD.attempt_ref,OLD.prereg_ref,OLD.intent_ref,OLD.fold_ref,OLD.ordinal,OLD.budget_ref,OLD.semantic_ref,OLD.semantic_binding,OLD.prereg) THEN RAISE EXCEPTION 'IMMUTABLE_PREREGISTRATION'; END IF;
  IF NOT ((OLD.state='REGISTERED' AND NEW.state='CLAIMED') OR (OLD.state='CLAIMED' AND NEW.state='STARTED') OR (OLD.state='STARTED' AND NEW.state='TERMINAL')) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF OLD.state<>'REGISTERED' AND (NEW.worker_ref,NEW.token) IS DISTINCT FROM (OLD.worker_ref,OLD.token) THEN RAISE EXCEPTION 'CLAIM_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_budget BEFORE UPDATE OR DELETE ON math_experiment_lab.budgets FOR EACH ROW EXECUTE FUNCTION math_experiment_lab.guard_immutable();
CREATE TRIGGER immutable_attempt BEFORE UPDATE OR DELETE ON math_experiment_lab.attempts FOR EACH ROW EXECUTE FUNCTION math_experiment_lab.guard_immutable();
CREATE TRIGGER immutable_command BEFORE UPDATE OR DELETE ON math_experiment_lab.commands FOR EACH ROW EXECUTE FUNCTION math_experiment_lab.guard_immutable();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA math_experiment_lab FROM PUBLIC;
-- No grants, role creation, migration execution or automatic reclaim.
