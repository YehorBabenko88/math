BEGIN;
-- Keep migration 003 immutable. A permanent singleton avoids an invisible
-- guard insertion in a transaction carrying a pre-fence repeatable-read snapshot.
CREATE TABLE mu_book_cutover_epoch (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 generation bigint NOT NULL CHECK(generation BETWEEN 0 AND 9007199254740991)
);
INSERT INTO mu_book_cutover_epoch(singleton,generation)
 SELECT true,coalesce((SELECT generation FROM mu_book_cutover_guard WHERE singleton),0);
CREATE OR REPLACE FUNCTION mu_book_check_cutover_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text; epoch bigint; guard_generation bigint;
BEGIN
 -- Epoch -> guard -> queue metadata is the shared controller/writer lock order.
 -- Locks survive until transaction end; an old snapshot must serialize or fail.
 SELECT generation INTO epoch FROM mu_book_cutover_epoch WHERE singleton FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Book fence epoch missing' USING ERRCODE='55000'; END IF;
 SELECT capability_hash,generation INTO expected,guard_generation FROM mu_book_cutover_guard WHERE singleton FOR SHARE;
 IF FOUND AND encode(sha256(convert_to(coalesce(current_setting('mu.book_cutover_token',true),''),'UTF8')),'hex') <> expected THEN
  RAISE EXCEPTION 'Book target is fenced for staging' USING ERRCODE='55000';
 END IF;
 IF epoch <> coalesce(guard_generation,0) THEN
  RAISE EXCEPTION 'Book fence epoch mismatch' USING ERRCODE='55000';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
-- Temp tables are creatable by ordinary database users. Resolve guard tables
-- in the migration's trusted schema, never in the caller's search_path/pg_temp.
DO $pin$
BEGIN
 EXECUTE format('ALTER FUNCTION %I.mu_book_check_cutover_guard() SET search_path = pg_catalog, %I, pg_temp',current_schema(),current_schema());
END;
$pin$;
COMMIT;
