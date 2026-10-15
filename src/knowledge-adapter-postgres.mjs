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
   const payload=JSON.parse(json);
   const result=await pool.query(
    'INSERT INTO mu_adapter_snapshots (schema_version,payload,sha256) VALUES ($1,$2::jsonb,$3) ON CONFLICT (sha256) DO UPDATE SET sha256 = EXCLUDED.sha256 RETURNING snapshot_id,sha256',
    [payload.schema,JSON.stringify(payload),digest]
   );
   return {snapshotId:result.rows[0].snapshot_id,sha256:result.rows[0].sha256};
  },
  async latest(){
   const result=await pool.query('SELECT payload FROM mu_adapter_snapshots ORDER BY created_at DESC,snapshot_id DESC LIMIT 1');
   if(!result.rows.length)return null;
   const payload=result.rows[0].payload;
   return restoreKnowledgeAdapterRegistry(JSON.stringify(typeof payload==='string'?JSON.parse(payload):payload));
  }
 });
}
