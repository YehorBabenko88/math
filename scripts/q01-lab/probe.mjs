// Test-only synchronization. Does not rewrite or import a replacement queue implementation.
import {existsSync} from 'node:fs';
import {join} from 'node:path';
const config=JSON.parse(process.env.Q01_WORKER_CONFIG??'{}');
const origin=process.hrtime.bigint();
const held=new Set();
export function alive(){try{process.kill(config.parentPid,0);}catch{throw Error('LAB_PARENT_LOST');}}
export function emit(phase,data={}){alive();if(process.connected)process.send({kind:'phase',data:{phase,elapsedNs:String(process.hrtime.bigint()-origin),...data}});}
export function barrier(phase){
 emit(phase);
 if(config.hook?.barrier!==phase||held.has(phase))return;held.add(phase);
 process.send({kind:'barrier',data:{phase,elapsedNs:String(process.hrtime.bigint()-origin)}});
 const release=join(config.barrierDirectory,phase+'.release'),deadline=performance.now()+20000;
 const signal=new Int32Array(new SharedArrayBuffer(4));
 while(!existsSync(release)){alive();if(performance.now()>deadline)throw Error('LAB_BARRIER_TIMEOUT');Atomics.wait(signal,0,0,10);}
 emit(phase+'-released');
}
export function diagnostic(operation,error){emit('native-error',{operation,code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'REDACTED',sqliteCode:Number.isInteger(error.errcode)?error.errcode:-1});}
export function fault(phase){if(config.hook?.fault===phase)throw Object.assign(Error('LAB_INJECTED'),{code:'EIO'});}
