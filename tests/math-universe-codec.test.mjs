import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {decodeMetadata,encodeMetadata,semanticDigest,binary64Hex,decodeBinary64Hex} from '../src/math-universe-codec.mjs';
test('ASCII lexical keys and canonical roundtrip',()=>{const s='{"10":"a","2":"b","x":[true,null,1]}';assert.equal(encodeMetadata(decodeMetadata(Buffer.from(s))).toString(),s);});
test('raw duplicate decoded keys and invalid forms',()=>{for(const s of ['{"a":1,"\\u0061":2}','{"x":-0}','{"x":9007199254740992}','{"x":1.0}','{"x":1e0}','{"x":"\\ud800"}','{"__proto__":1}','[1,]','true false'])assert.throws(()=>decodeMetadata(Buffer.from(s)),/INVALID_METADATA/);assert.throws(()=>decodeMetadata(Uint8Array.of(0xc0,0x80)));assert.throws(()=>decodeMetadata(Uint8Array.of(239,187,191,49)));});
test('reject unsafe objects without invoking getter',()=>{let called=false;const x={get a(){called=true;return 1;}};assert.throws(()=>encodeMetadata(x));assert.equal(called,false);assert.throws(()=>encodeMetadata(new Proxy({},{})));assert.throws(()=>encodeMetadata([,1]));});
test('domain separator and binary64',()=>{assert.equal(semanticDigest('test.v1',{a:1}),createHash('sha256').update('test.v1\0{"a":1}').digest('hex'));assert.equal(binary64Hex(-0),'0000000000000000');assert.equal(binary64Hex(1),'3ff0000000000000');assert.equal(decodeBinary64Hex('0000000000000001'),Number.MIN_VALUE);for(const h of ['8000000000000000','7ff0000000000000','7ff8000000000000'])assert.throws(()=>decodeBinary64Hex(h));});
test('bounded input',()=>{assert.throws(()=>decodeMetadata(Buffer.alloc(262145)));assert.throws(()=>encodeMetadata('x'.repeat(262144)));assert.throws(()=>decodeMetadata(Buffer.from('['.repeat(26)+'0'+']'.repeat(26))));});
