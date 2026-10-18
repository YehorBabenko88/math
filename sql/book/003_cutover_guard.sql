BEGIN;
CREATE TABLE mu_book_cutover_guard (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 run_id uuid NOT NULL,
 source_id text NOT NULL CHECK(source_id ~ '^[a-f0-9]{64}$'),
 generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 capability_hash text NOT NULL CHECK(capability_hash ~ '^[a-f0-9]{64}$'),
 mode text NOT NULL CHECK(mode='STAGING')
);
CREATE FUNCTION mu_book_check_cutover_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected text;
BEGIN
 SELECT capability_hash INTO expected FROM mu_book_cutover_guard WHERE singleton FOR SHARE;
 IF FOUND AND encode(sha256(convert_to(coalesce(current_setting('mu.book_cutover_token',true),''),'UTF8')),'hex') <> expected THEN
  RAISE EXCEPTION 'Book target is fenced for staging' USING ERRCODE='55000';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER mu_book_queue_cutover_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON mu_book_queue FOR EACH STATEMENT EXECUTE FUNCTION mu_book_check_cutover_guard();
CREATE TRIGGER mu_book_jobs_cutover_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON mu_book_jobs FOR EACH STATEMENT EXECUTE FUNCTION mu_book_check_cutover_guard();
CREATE TRIGGER mu_book_reviews_cutover_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON mu_book_reviews FOR EACH STATEMENT EXECUTE FUNCTION mu_book_check_cutover_guard();
CREATE TRIGGER mu_book_imports_cutover_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON mu_book_imports FOR EACH STATEMENT EXECUTE FUNCTION mu_book_check_cutover_guard();
COMMIT;
