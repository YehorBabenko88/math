// SQLite's UTF-8 TEXT binding replaces lone UTF-16 surrogates. Ordinary legacy
// TEXT stays unchanged; only those strings use an explicitly versioned BLOB.
const PREFIX='book-sqlite-text/v1\n';
export function encodeSQLiteText(value){
 if(typeof value!=='string'||value.isWellFormed())return value;
 return Buffer.from(PREFIX+JSON.stringify(value),'utf8');
}
export function decodeSQLiteText(value){
 if(typeof value==='string')return value;
 if(!(value instanceof Uint8Array)||value.byteLength>8192)throw Error('Invalid queue state');
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(value);
 if(!text.startsWith(PREFIX))throw Error('Invalid queue state');
 const encoded=text.slice(PREFIX.length),decoded=JSON.parse(encoded);
 if(typeof decoded!=='string'||JSON.stringify(decoded)!==encoded||decoded.isWellFormed())throw Error('Invalid queue state');
 return decoded;
}
