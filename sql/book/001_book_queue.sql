BEGIN;
CREATE TABLE mu_book_queue (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 version integer NOT NULL DEFAULT 1 CHECK (version=1),
 max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 10)
);
CREATE TABLE mu_book_jobs (
 postgres_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sqlite_id char(64) UNIQUE NOT NULL CHECK (sqlite_id ~ '^[a-f0-9]{64}$'),
 ordinal integer UNIQUE NOT NULL CHECK (ordinal>=0),
 document jsonb NOT NULL,
 CHECK ((jsonb_typeof(document)='object') IS TRUE),
 CHECK ((jsonb_typeof(document->'id')='string' AND document->>'id'=sqlite_id::text) IS TRUE),
 CHECK ((jsonb_typeof(document->'sourceHash')='string' AND document->>'sourceHash' ~ '^[a-f0-9]{64}$') IS TRUE),
 CHECK ((jsonb_typeof(document->'edition')='string' AND length(btrim(document->>'edition')) BETWEEN 1 AND 500) IS TRUE),
 CHECK ((jsonb_typeof(document->'extractionVersion')='string' AND length(btrim(document->>'extractionVersion')) BETWEEN 1 AND 100) IS TRUE),
 CHECK ((jsonb_typeof(document->'page')='number' AND (document->>'page')::numeric BETWEEN 1 AND 1000000 AND (document->>'page')::numeric=trunc((document->>'page')::numeric)) IS TRUE),
 CHECK ((jsonb_typeof(document->'payload')='object') IS TRUE),
 CHECK ((jsonb_typeof(document->'state')='string' AND document->>'state' IN ('queued','leased','completed','failed')) IS TRUE),
 CHECK ((jsonb_typeof(document->'attempts')='number' AND (document->>'attempts')::numeric BETWEEN 0 AND 10 AND (document->>'attempts')::numeric=trunc((document->>'attempts')::numeric)) IS TRUE),
 CHECK ((jsonb_typeof(document->'createdAt')='number' AND (document->>'createdAt')::numeric BETWEEN 0 AND 9007199254740991 AND (document->>'createdAt')::numeric=trunc((document->>'createdAt')::numeric)) IS TRUE),
 CHECK ((jsonb_typeof(document->'updatedAt')='number' AND (document->>'updatedAt')::numeric BETWEEN (document->>'createdAt')::numeric AND 9007199254740991 AND (document->>'updatedAt')::numeric=trunc((document->>'updatedAt')::numeric)) IS TRUE),
 CHECK ((CASE WHEN document->>'state'='leased' THEN
  jsonb_typeof(document->'token')='string' AND document->>'token' ~ '^[a-f0-9]{64}$' AND
  jsonb_typeof(document->'workerId')='string' AND length(btrim(document->>'workerId')) BETWEEN 1 AND 100 AND
  jsonb_typeof(document->'leaseUntil')='number' AND (document->>'leaseUntil')::numeric BETWEEN (document->>'updatedAt')::numeric+1 AND 9007199254740991 AND (document->>'leaseUntil')::numeric=trunc((document->>'leaseUntil')::numeric) AND (document->>'attempts')::numeric>0
 ELSE NOT(document ?| ARRAY['token','workerId','leaseUntil']) END) IS TRUE),
 CHECK ((CASE WHEN document->>'state'='completed' THEN jsonb_typeof(document->'result')='object' AND jsonb_typeof(document->'metrics')='object' AND (document->>'attempts')::numeric>0 AND NOT(document ? 'errorCode')
 ELSE NOT(document ?| ARRAY['result','metrics']) END) IS TRUE),
 CHECK ((NOT(document ? 'checkpoint') OR jsonb_typeof(document->'checkpoint')='object') IS TRUE),
 CHECK ((NOT(document ? 'errorCode') OR (jsonb_typeof(document->'errorCode')='string' AND document->>'errorCode' ~ '^[A-Z][A-Z0-9_]{0,63}$')) IS TRUE),
 CHECK ((document->>'state'<>'failed' OR ((document->>'attempts')::numeric>0 AND document ? 'errorCode')) IS TRUE)
);
CREATE TABLE mu_book_reviews (
 sqlite_id char(64) PRIMARY KEY REFERENCES mu_book_jobs(sqlite_id) ON DELETE CASCADE,
 candidate_digest char(64) NOT NULL CHECK (candidate_digest ~ '^[a-f0-9]{64}$'),
 receipt jsonb NOT NULL,
 CHECK ((jsonb_typeof(receipt)='object') IS TRUE),
 CHECK ((jsonb_typeof(receipt->'candidateDigest')='string' AND receipt->>'candidateDigest'=candidate_digest::text) IS TRUE),
 CHECK ((jsonb_typeof(receipt->'decision')='string' AND receipt->>'decision' IN ('approved','rejected')) IS TRUE),
 CHECK ((jsonb_typeof(receipt->'visualVerified')='boolean') IS TRUE),
 CHECK ((jsonb_typeof(receipt->'reviewer')='string' AND length(btrim(receipt->>'reviewer')) BETWEEN 1 AND 200) IS TRUE),
 CHECK ((jsonb_typeof(receipt->'reason')='string' AND length(btrim(receipt->>'reason')) BETWEEN 1 AND 1000) IS TRUE),
 CHECK ((jsonb_typeof(receipt->'reviewedAt')='string' AND receipt->>'reviewedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') IS TRUE)
);
CREATE TABLE mu_book_imports (
 snapshot_hash char(64) PRIMARY KEY CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
 target_hash char(64) NOT NULL CHECK (target_hash ~ '^[a-f0-9]{64}$'),
 manifest jsonb NOT NULL CHECK ((jsonb_typeof(manifest)='object') IS TRUE)
);
COMMIT;
