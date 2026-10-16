import {randomUUID} from 'node:crypto';

// Only tests call this helper. Never connect unless the caller explicitly
// supplied a disposable test database URL. Every invocation owns its schema.
export async function withIsolatedPostgres(url,run){
 if(typeof url!=='string'||!url)throw Error('Explicit disposable database URL required');
 const {default:pg}=await import('pg');
 const schema='mu_it_'+randomUUID().replaceAll('-','');
 const admin=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:5000});
 let pool,created=false;
 try{
  await admin.query(`CREATE SCHEMA "${schema}"`);created=true;
  pool=new pg.Pool({connectionString:url,options:'-c search_path='+schema,max:5,connectionTimeoutMillis:5000});
  assertSchema((await pool.query('SELECT current_schema() AS name')).rows[0].name,schema);
  return await run({pool,schema,url});
 }finally{
  await pool?.end();
  try{if(created){if(!/^mu_it_[a-f0-9]{32}$/.test(schema))throw Error('Invalid test schema');await admin.query(`DROP SCHEMA "${schema}" CASCADE`)}}
  finally{await admin.end()}
 }
}
function assertSchema(actual,expected){if(actual!==expected)throw Error('Isolated test schema was not selected');}
