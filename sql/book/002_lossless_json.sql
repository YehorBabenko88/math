BEGIN;
-- This validates the ASCII transport envelope only. The application verifies
-- decoded byte length, digest, fatal UTF-8, canonical JSON and projection match.
CREATE FUNCTION mu_book_valid_wire_v1(wire jsonb, maxbytes integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n numeric; data text;
BEGIN
 IF wire IS NULL OR jsonb_typeof(wire)<>'object' THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(wire))<>5
  OR NOT wire ?& ARRAY['schemaVersion','encoding','byteLength','sha256','data'] THEN RETURN false; END IF;
 IF jsonb_typeof(wire->'schemaVersion')<>'string' OR wire->>'schemaVersion'<>'book-json/v1'
  OR jsonb_typeof(wire->'encoding')<>'string' OR wire->>'encoding'<>'base64-utf8-json'
  OR jsonb_typeof(wire->'byteLength')<>'number'
  OR jsonb_typeof(wire->'sha256')<>'string'
  OR jsonb_typeof(wire->'data')<>'string' THEN RETURN false; END IF;
 n := (wire->>'byteLength')::numeric;
 IF n<0 OR n>maxbytes OR n<>trunc(n) THEN RETURN false; END IF;
 data := wire->>'data';
 RETURN (wire->>'sha256' ~ '^[a-f0-9]{64}$')
  AND length(data)<=ceil(n/3)*4
  AND data ~ '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$';
END;
$$;
ALTER TABLE mu_book_jobs
 ADD COLUMN document_encoding smallint NOT NULL DEFAULT 0,
 ADD COLUMN document_wire jsonb,
 ADD CONSTRAINT mu_book_jobs_document_encoding CHECK (
  (document_encoding=0 AND document_wire IS NULL) OR
  (document_encoding=1 AND mu_book_valid_wire_v1(document_wire,8388608)));
ALTER TABLE mu_book_reviews
 ADD COLUMN receipt_encoding smallint NOT NULL DEFAULT 0,
 ADD COLUMN receipt_wire jsonb,
 ADD CONSTRAINT mu_book_reviews_receipt_encoding CHECK (
  (receipt_encoding=0 AND receipt_wire IS NULL) OR
  (receipt_encoding=1 AND mu_book_valid_wire_v1(receipt_wire,8192)));
-- Never reinterpret a v1 structural projection as a legacy source document.
CREATE FUNCTION mu_book_guard_document_encoding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.document_encoding=1 AND NEW.document_encoding<>1 THEN RAISE EXCEPTION 'Book JSON encoding downgrade rejected'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER mu_book_document_no_downgrade BEFORE UPDATE OF document_encoding ON mu_book_jobs
 FOR EACH ROW EXECUTE FUNCTION mu_book_guard_document_encoding();
CREATE FUNCTION mu_book_guard_receipt_encoding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.receipt_encoding=1 AND NEW.receipt_encoding<>1 THEN RAISE EXCEPTION 'Book JSON encoding downgrade rejected'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER mu_book_receipt_no_downgrade BEFORE UPDATE OF receipt_encoding ON mu_book_reviews
 FOR EACH ROW EXECUTE FUNCTION mu_book_guard_receipt_encoding();
COMMIT;
