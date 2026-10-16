# Fenced PostgreSQL ingestion checkpoints

Apply the opt-in migrations through `004_ingestion_checkpoints.sql` before using the fenced store. The migration adds a nullable `checkpoint jsonb` column; existing jobs retain `NULL`. Drain legacy workers before switching, and never mix fenced and legacy workers on the same queue.

`createFencedIngestionJobStore(pool).checkpoint({jobId, workerId, claimToken, checkpoint})` replaces a checkpoint only when the job is running, its worker and claim token match, and its lease is still strictly later than the database transaction's `now()`. A stale token, wrong owner, or expired lease produces the same rejection as `renew`. Saving a checkpoint does not extend the lease. Retry and expiry recovery preserve it for the next claim; the worker must independently verify its contents before resuming.

Checkpoint input must be a plain JSON object. Validation rejects accessors, serialization hooks, cycles, sparse arrays, unsupported values and exotic prototypes before querying PostgreSQL. The serialized UTF-8 JSON limit is 256 KiB, with at most 20,000 visited values and 24 nesting levels. This validates inert data, not the application's checkpoint schema. Checkpoints may contain private document data and require the queue's access and retention controls.

`claim({workerId, leaseSeconds, jobId})` optionally targets one positive safe integer ID. Without `jobId`, selection retains queue order and `SKIP LOCKED` behavior. A running lease expires at `lease_until <= now()`. In the same statement, expired running jobs with exhausted attempts become failed and have their owner, token and lease cleared; an explicit `jobId` also scopes this maintenance to that job. Claim returns `worker_id` and `checkpoint`. PostgreSQL bigint job IDs are returned as JavaScript safe integers; larger IDs are unsupported and rejected.

The migration runner holds its advisory lock and all unapplied scripts in one outer transaction. It strips script-level transaction wrappers, including header/footer comments, while preserving function bodies. Nothing invokes migrations or starts ingestion automatically.
