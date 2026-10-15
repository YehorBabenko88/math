import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.env.MATH_PORT??8787);
const host=process.env.MATH_HOST??'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const allowed=new Set(['index.html','style.css']);
function route(url){
 const path=new URL(url,'http://localhost').pathname;
 if(path==='/healthz')return {health:true};
 let decoded;
 try{decoded=decodeURIComponent(path)}catch{return null}
 if(decoded.includes('\\')||decoded.includes('\0'))return null;
 const relative=decoded==='/'?'index.html':decoded.replace(/^\//,'');
 if(!allowed.has(relative)&&!/^src\/[a-zA-Z0-9_.-]+\.mjs$/.test(relative))return null;
 const absolute=resolve(root,relative);
 if(!absolute.startsWith(root+sep))return null;
 return {absolute};
}
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
 const target=route(req.url??'/');
 if(!target){res.writeHead(404);res.end();return}
 if(target.health){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({status:'ok'}));return}
 try{
  const file=await stat(target.absolute);
  if(!file.isFile()||file.size>5_000_000)throw Error('Invalid file');
  const body=await readFile(target.absolute);
  res.writeHead(200,{'content-type':types[extname(target.absolute)]??'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"});
  res.end(req.method==='HEAD'?undefined:body);
 }catch{res.writeHead(404);res.end()}
});
server.listen(port,host,()=>console.log('Math Universe local UI: http://'+host+':'+port));
