// Optional PostgreSQL persistence adapter. Supply an injected pg-compatible pool;
// this module does not install packages or open connections on import.
import {createHash} from 'node:crypto';
import {restoreKnowledgeAdapterRegistry} from './knowledge-adapter-persistence.mjs';
function hash(s){return createHash('sha256').update(s).digest('hex')}
export function createPostgresAdapterSnapshotStore(pool){
 if(!pool||typeof pool.query!=='function')throw Error('PostgreSQL pool required');
 return Object.freeze({
  async save(registry){
   if(!registry||typeof registry.exportJSON!=='function')throw Error('Registry required');
   const json=registry.exportJSON();
   restoreKnowledgeAdapterRegistry(json); // reject invalid state before persistence
   const digest=hash(json);
   // Preserve the exact JSON that defines v1 proposal IDs. JSONB object order
   // is not stable; a nested string preserves order, NUL and lone surrogates.
   const payload={format:'math-universe-adapter-snapshot/v1',json};
   const result=await pool.query(
    'INSERT INTO mu_adapter_snapshots (schema_version,payload,sha256) VALUES ($1,$2::jsonb,$3) ON CONFLICT (sha256) DO UPDATE SET payload = EXCLUDED.payload,schema_version = EXCLUDED.schema_version RETURNING snapshot_id,sha256',
    [JSON.parse(json).schema,JSON.stringify(payload),digest]
   );
   return {snapshotId:result.rows[0].snapshot_id,sha256:result.rows[0].sha256};
  },
  async latest(){
   const result=await pool.query('SELECT payload,sha256,schema_version FROM mu_adapter_snapshots ORDER BY created_at DESC,snapshot_id DESC LIMIT 1');
   if(!result.rows.length)return null;
   const row=result.rows[0];
   const payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
   const envelope=payload?.format==='math-universe-adapter-snapshot/v1';
   if(payload?.format&&!envelope)throw Error('Unsupported registry snapshot format');
   const json=envelope?payload.json:JSON.stringify(payload);
   if(typeof json!=='string'||json.length>5_000_000||hash(json)!==row.sha256)throw Error('Registry snapshot checksum mismatch; legacy JSONB history may be unverifiable');
   if(JSON.parse(json).schema!==row.schema_version)throw Error('Registry snapshot schema mismatch');
   // Legacy JSONB is restorable only if BOTH the original snapshot checksum
   // and every proposal fingerprint verify; never regenerate historical IDs.
   return restoreKnowledgeAdapterRegistry(json);
  }
 });
}
