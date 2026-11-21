// Catalog-aware pg client fixture. Its ledger entries describe only scripts
// actually supplied in this test, never inferred history from current files.
const cache=new WeakMap();
export function migrationClient(delegate,{entries=[]}={}){
 if(cache.has(delegate))return cache.get(delegate);
 let exists=entries.length>0;const rows=entries.map(x=>({...x}));
 const wrapped={release:e=>delegate.release(e),async query(sql,args){
  const result=await delegate.query(sql,args);
  if(sql==='SELECT pg_catalog.current_schema() AS schema')return {rows:[{schema:'fixture'}]};
  if(sql.includes('AS unsafe'))return {rows:[{unsafe:false}]};
  if(sql.includes('FROM pg_catalog.pg_class'))return {rows:exists?[{oid:'100',relkind:'r',relrowsecurity:false,relforcerowsecurity:false}]:[]};
  if(sql.startsWith('SELECT attname,'))return {rows:[['filename',25],['applied_at',1184],['sha256',25],['hash_contract',25]].map(([attname,type])=>({attname,type,attnotnull:true}))};
  if(sql.includes(' AS valid'))return {rows:[{valid:true}]};
  if(sql.startsWith('SELECT filename,applied_at::text'))return {rows:structuredClone(rows)};
  if(sql.startsWith('CREATE TABLE "fixture".mu_schema_migrations'))exists=true;
  if(sql.startsWith('INSERT INTO "fixture".mu_schema_migrations'))rows.push({filename:args[0],sha256:args[1],hash_contract:args[2],applied_at:'2026-01-01T00:00:00Z'});
  return result;
 }};cache.set(delegate,wrapped);return wrapped;
}
