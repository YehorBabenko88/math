BEGIN;
-- No role names or deployment credentials are provisioned by migrations.
-- Ordinary writers need no lock/update authority on control tables: the fixed,
-- schema-pinned trigger performs only its own control reads under its owner.
ALTER FUNCTION mu_book_check_cutover_guard() SECURITY DEFINER;
REVOKE ALL ON mu_book_cutover_epoch,mu_book_cutover_guard,mu_book_schema_migrations FROM PUBLIC;
REVOKE ALL ON FUNCTION mu_book_check_cutover_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION mu_book_guard_document_encoding(),mu_book_guard_receipt_encoding() FROM PUBLIC;

CREATE FUNCTION mu_book_lock_control() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 PERFORM generation FROM mu_book_cutover_epoch WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Book control epoch missing'; END IF;
 RETURN NULL;
END;
$$;
CREATE FUNCTION mu_book_monotonic_control() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.generation<=OLD.generation THEN RAISE EXCEPTION 'Book control generation must increase'; END IF;
  IF TG_TABLE_NAME='mu_book_cutover_guard' THEN
   IF NEW.run_id<>OLD.run_id OR NEW.source_id<>OLD.source_id THEN RAISE EXCEPTION 'Book control owner immutable'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE FUNCTION mu_book_no_control_removal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Book control removal prohibited';
END;
$$;
CREATE FUNCTION mu_book_check_control_pair() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE epoch bigint; guard_generation bigint;
BEGIN
 SELECT generation INTO epoch FROM mu_book_cutover_epoch WHERE singleton FOR UPDATE;
 SELECT generation INTO guard_generation FROM mu_book_cutover_guard WHERE singleton FOR UPDATE;
 IF epoch IS NULL OR epoch<>coalesce(guard_generation,0) THEN RAISE EXCEPTION 'Book control epoch/generation mismatch'; END IF;
 RETURN NULL;
END;
$$;
CREATE TRIGGER mu_book_guard_lock BEFORE INSERT OR UPDATE ON mu_book_cutover_guard FOR EACH STATEMENT EXECUTE FUNCTION mu_book_lock_control();
CREATE TRIGGER mu_book_guard_monotonic BEFORE UPDATE ON mu_book_cutover_guard FOR EACH ROW EXECUTE FUNCTION mu_book_monotonic_control();
CREATE TRIGGER mu_book_epoch_monotonic BEFORE UPDATE ON mu_book_cutover_epoch FOR EACH ROW EXECUTE FUNCTION mu_book_monotonic_control();
CREATE TRIGGER mu_book_guard_no_removal BEFORE DELETE OR TRUNCATE ON mu_book_cutover_guard FOR EACH STATEMENT EXECUTE FUNCTION mu_book_no_control_removal();
CREATE TRIGGER mu_book_epoch_no_removal BEFORE DELETE OR TRUNCATE ON mu_book_cutover_epoch FOR EACH STATEMENT EXECUTE FUNCTION mu_book_no_control_removal();
CREATE CONSTRAINT TRIGGER mu_book_guard_pair AFTER INSERT OR UPDATE ON mu_book_cutover_guard DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION mu_book_check_control_pair();
CREATE CONSTRAINT TRIGGER mu_book_epoch_pair AFTER INSERT OR UPDATE ON mu_book_cutover_epoch DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION mu_book_check_control_pair();
DO $pin$
DECLARE fn text; epoch bigint; guard_generation bigint;
BEGIN
 SELECT generation INTO epoch FROM mu_book_cutover_epoch WHERE singleton FOR UPDATE;
 SELECT generation INTO guard_generation FROM mu_book_cutover_guard WHERE singleton FOR UPDATE;
 IF epoch IS NULL OR epoch<>coalesce(guard_generation,0) THEN RAISE EXCEPTION 'Book control epoch/generation mismatch'; END IF;
 FOREACH fn IN ARRAY ARRAY['mu_book_check_cutover_guard','mu_book_lock_control','mu_book_monotonic_control','mu_book_no_control_removal','mu_book_check_control_pair'] LOOP
  EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = pg_catalog, %I, pg_temp',current_schema(),fn,current_schema());
  EXECUTE format('REVOKE ALL ON FUNCTION %I.%I() FROM PUBLIC',current_schema(),fn);
 END LOOP;
END;
$pin$;
COMMIT;
