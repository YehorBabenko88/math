export const blocked=()=>{throw Error('Confidential evidence BLOCKED');};
export function need(ok){if(!ok)blocked();}
// Bounded recursive JSON parser: duplicate keys and prototype names are denied.
export function strictJson(input,maxBytes=65536){
 need((typeof input==='string'||Buffer.isBuffer(input))&&Buffer.byteLength(input)<=maxBytes);let text;try{text=Buffer.isBuffer(input)?new TextDecoder('utf-8',{fatal:true}).decode(input):input;}catch{blocked();}let i=0,nodes=0;
 const white=()=>{while(/[\x20\t\n\r]/.test(text[i]??'')&&i<text.length)i++;};
 function string(){const start=i;need(text[i++]==='"');while(i<text.length){const c=text[i++];if(c==='"')return JSON.parse(text.slice(start,i));need(c.charCodeAt(0)>=32);if(c==='\\'){need(i<text.length);if(text[i++]==='u'){need(/^[a-fA-F0-9]{4}$/.test(text.slice(i,i+4)));i+=4;}}}blocked();}
 function value(depth){need(depth<=16&&++nodes<=4096);white();const c=text[i];if(c==='"')return string();if(c==='{'){i++;const obj=Object.create(null),seen=new Set();white();if(text[i]==='}'){i++;return obj;}for(;;){white();need(text[i]==='"');const k=string();need(!seen.has(k)&&!['__proto__','constructor','prototype'].includes(k));seen.add(k);white();need(text[i++]===':');obj[k]=value(depth+1);white();const end=text[i++];if(end==='}')return obj;need(end===',');}}
 if(c==='['){i++;const a=[];white();if(text[i]===']'){i++;return a;}for(;;){a.push(value(depth+1));white();const end=text[i++];if(end===']')return a;need(end===',');}}
 const m=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);need(m);i+=m[0].length;const v=JSON.parse(m[0]);need(typeof v!=='number'||Number.isFinite(v));return v;}
 try{const result=value(0);white();need(i===text.length);return result;}catch{blocked();}
}
export function exact(object,keys){need(object!==null&&typeof object==='object'&&!Array.isArray(object)&&Reflect.ownKeys(object).length===keys.length&&keys.every(k=>Object.hasOwn(object,k)));}
export const oid=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
export const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const id=x=>typeof x==='string'&&/^[1-9][0-9]{0,19}$/.test(x);
