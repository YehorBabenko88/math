// Test-only error-path observation. No code replacement occurs in production.
import {createHash} from 'node:crypto';
const expected='d7507146007bf1f2e1c2635c89f85966e32b9cd2e77132ed78d6a3254c5525ca';
export function instrumentQueue(raw){
 const source=(typeof raw==='string'?raw:Buffer.from(raw).toString('utf8')).replaceAll('\r\n','\n');
 if(createHash('sha256').update(source).digest('hex')!==expected)throw Error('Unrecognized queue diagnostic source');
 const receipt=`const __q01Receipt=data=>{if(process.connected)process.send({kind:'phase',data});};\nconst __q01Error=(phase,e)=>__q01Receipt({phase,kind:['Unsafe queue storage','Invalid queue state','database is locked','database is busy'].includes(e.message)?e.message:'REDACTED',code:/^[A-Z0-9_]+$/.test(e.code??'')?e.code:'REDACTED',sqliteCode:Number.isInteger(e.errcode)?e.errcode:-1});\n`;
 let changed=source;
 function replace(from,to){if(changed.split(from).length!==2)throw Error('Ambiguous diagnostic insertion');changed=changed.replace(from,to);}
 const safety="assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'Unsafe queue storage');";
 replace(safety,"try{"+safety+"}catch(__error){__q01Receipt({phase:'unsafe-storage',kind:name,links:s.nlink,size:s.size,regular:s.isFile(),symlink:s.isSymbolicLink()});throw __error;}");
 replace("catch{throw Error('Invalid queue directory');}","catch(__error){__q01Error('directory-error',__error);throw Error('Invalid queue directory');}");
 replace("db=new DatabaseSync(join(path,'queue.sqlite'));","try{db=new DatabaseSync(join(path,'queue.sqlite'));}catch(__error){__q01Error('constructor-error',__error);throw __error;}");
 replace('}catch(e){if(db){',"}catch(e){__q01Error('transaction-error',e);if(db){");
 replace('}finally{db?.close();}',"}finally{try{db?.close();}catch(__error){__q01Error('close-error',__error);throw __error;}}");
 return receipt+changed;
}
