// Disposable PG18 test harness only. No implicit approval or production fallback.
const PORT=25432;
const ROLES=Object.freeze({math_experiment_owner:'math_experiment_test',math_experiment_host:'math_experiment_test',memory_lab:'scientific_memory_test'});
const APPROVAL='MASTER_APPROVED_DISPOSABLE_PG18_25432';
const refuse=()=>{throw Error('PG_LAB_REFUSED');};
export function labEnvironment(env=process.env){
 if(Object.keys(env).some(k=>/^PG/i.test(k)||/^NODE_PG_FORCE_NATIVE$/i.test(k)))refuse();
 if(env.MATH_PG_LAB_APPROVAL!==APPROVAL||typeof env.MATH_PG_LAB_SYSTEM_ID!=='string'||!/^[1-9][0-9]{0,19}$/.test(env.MATH_PG_LAB_SYSTEM_ID)||/[^0-9]/.test(env.MATH_PG_LAB_SYSTEM_ID)||BigInt(env.MATH_PG_LAB_SYSTEM_ID)>18446744073709551615n)refuse();
 return {...env};
}
export function labConfig(url,role,env=process.env){
 labEnvironment(env);
 if(typeof role!=='string'||!Object.hasOwn(ROLES,role)||typeof url!=='string'||url.length>512)refuse();
 // Exact ASCII grammar: no URL normalization, encoded delimiters, query, fragment or empty delimiters.
 const m=/^postgresql:\/\/([a-z_]+):([A-Za-z0-9._~-]{1,128})@127\.0\.0\.1:25432\/([a-z_]+)$/.exec(url);
 if(!m||m[0]!==url||m[1]!==role||m[3]!==ROLES[role])refuse();
 return Object.freeze({host:'127.0.0.1',port:PORT,database:ROLES[role],user:role,password:m[2],ssl:false,connectionTimeoutMillis:3000});
}
export function checkedClient(Client,url,role){
 const cfg=labConfig(url,role);const c=new Client({...cfg});const p=c.connectionParameters;
 if(!p||['host','port','database','user','password','ssl'].some(k=>p[k]!==cfg[k])||p.isDomainSocket||p.options)refuse();
 return c;
}
export async function connectLab(Client,url,role){
 const env=labEnvironment();const c=checkedClient(Client,url,role);
 try{
  await c.connect();
  const q=await c.query("SELECT pg_catalog.current_database() AS db,current_user AS role,session_user AS session_role,pg_catalog.current_setting('server_version_num')::int AS version,pg_catalog.host(pg_catalog.inet_server_addr()) AS host,pg_catalog.inet_server_port() AS port,(SELECT system_identifier::text FROM pg_catalog.pg_control_system()) AS system_id,(SELECT r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid) FROM pg_catalog.pg_roles r WHERE r.rolname=current_user) AS privileged");
  const g=q.rows[0];if(q.rows.length!==1||g.db!==ROLES[role]||g.role!==role||g.session_role!==role||!Number.isInteger(g.version)||g.version<180000||g.version>=190000||g.host!=='127.0.0.1'||g.port!==PORT||g.system_id!==env.MATH_PG_LAB_SYSTEM_ID||g.privileged!==false)refuse();
  return c;
 }catch{try{await c.end();}catch{}refuse();}
}
