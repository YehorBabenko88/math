import {createHash} from 'node:crypto';
import {types} from 'node:util';
const MAX=262144, DEPTH=24, NODES=100000;
const fail=()=>{throw new Error('INVALID_METADATA');};
const keyOK=k=>/^[\x20-\x7e]+$/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
function stringOK(s){for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const d=s.charCodeAt(++i);if(!(d>=0xdc00&&d<=0xdfff))fail();}else if(c>=0xdc00&&c<=0xdfff)fail();}return s;}
export function encodeMetadata(value){
 let count=0, bytes=0;const parts=[], active=new Set();
 function emit(s){bytes+=Buffer.byteLength(s);if(bytes>MAX)fail();parts.push(s);}
 function visit(v,d){if(++count>NODES||d>DEPTH)fail();if(v===null||typeof v==='boolean'){emit(String(v));return;}
 if(typeof v==='number'){if(!Number.isSafeInteger(v)||Object.is(v,-0))fail();emit(String(v));return;}
 if(typeof v==='string'){if(v.length>MAX)fail();emit(JSON.stringify(stringOK(v)));return;}
 if(typeof v!=='object'||types.isProxy(v)||active.has(v))fail();active.add(v);
 const keys=Reflect.ownKeys(v);if(keys.length>NODES)fail();
 if(Array.isArray(v)){if(v.length>NODES||keys.length!==v.length+1)fail();emit('[');for(let i=0;i<v.length;i++){const p=Object.getOwnPropertyDescriptor(v,String(i));if(!p||!('value' in p)||!p.enumerable)fail();if(i)emit(',');visit(p.value,d+1);}emit(']');}
 else{const proto=Object.getPrototypeOf(v);if(proto!==null&&proto!==Object.prototype)fail();if(keys.some(k=>typeof k!=='string'||!keyOK(k)))fail();keys.sort();emit('{');for(let i=0;i<keys.length;i++){const k=keys[i],p=Object.getOwnPropertyDescriptor(v,k);if(!p.enumerable||!('value' in p))fail();if(i)emit(',');emit(JSON.stringify(k));emit(':');visit(p.value,d+1);}emit('}');}active.delete(v);
 }visit(value,0);return Buffer.from(parts.join(''),'utf8');
}
export function decodeMetadata(bytes){
 if(!ArrayBuffer.isView(bytes)||!(bytes instanceof Uint8Array)||types.isProxy(bytes)||bytes.byteLength>MAX)fail();
 const raw=Buffer.from(bytes);if(raw[0]===239&&raw[1]===187&&raw[2]===191)fail();let s;try{s=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch{fail();}
 let i=0,count=0;const ws=()=>{while(i<s.length&&/[ \t\r\n]/.test(s[i]))i++;};
 function str(){if(s[i++]!=='"')fail();const start=i-1;while(i<s.length){const c=s[i++];if(c==='"'){let v;try{v=JSON.parse(s.slice(start,i));}catch{fail();}return stringOK(v);}if(c==='\\'){if(i>=s.length)fail();i++;}else if(c.charCodeAt(0)<32)fail();}fail();}
 function read(d){if(++count>NODES||d>DEPTH)fail();ws();const c=s[i];if(c==='"')return str();if(c==='{'){i++;const o=Object.create(null);ws();if(s[i]==='}'){i++;return o;}for(;;){ws();const k=str();if(!keyOK(k)||Object.hasOwn(o,k))fail();ws();if(s[i++]!==':')fail();o[k]=read(d+1);ws();const q=s[i++];if(q==='}')return o;if(q!==',')fail();}}
 if(c==='['){i++;const a=[];ws();if(s[i]===']'){i++;return a;}for(;;){a.push(read(d+1));ws();const q=s[i++];if(q===']')return a;if(q!==',')fail();}}
 for(const [token,v] of [['null',null],['true',true],['false',false]])if(s.startsWith(token,i)){i+=token.length;return v;}
 const m=/-?(?:0|[1-9][0-9]*)/y;m.lastIndex=i;const hit=m.exec(s);if(!hit)fail();i=m.lastIndex;const v=Number(hit[0]);if(!Number.isSafeInteger(v)||Object.is(v,-0)||String(v)!==hit[0])fail();return v;
 }const result=read(0);ws();if(i!==s.length)fail();return result;
}
export function semanticDigest(schema,value){if(typeof schema!=='string'||!/^[A-Za-z0-9._-]{1,128}$/.test(schema))fail();return createHash('sha256').update(schema,'ascii').update(Buffer.from([0])).update(encodeMetadata(value)).digest('hex');}
export function binary64Hex(value){if(typeof value!=='number'||!Number.isFinite(value))throw new Error('INVALID_NUMBER');const b=Buffer.alloc(8);b.writeDoubleBE(value===0?0:value);return b.toString('hex');}
export function decodeBinary64Hex(hex){if(typeof hex!=='string'||!/^[0-9a-f]{16}$/.test(hex))throw new Error('INVALID_NUMBER');const v=Buffer.from(hex,'hex').readDoubleBE();if(!Number.isFinite(v)||Object.is(v,-0))throw new Error('INVALID_NUMBER');return v;}
