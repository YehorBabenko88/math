import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestionSupervisor} from '../src/ingestion-supervisor.mjs';
test('supervisor backs off after PostgreSQL failure and recovers',async()=>{
 let calls=0,stopped=0,drained=0;
 const waits=[];
 let supervisor;
 const worker={async tick(){calls++;if(calls===1)throw Error('postgres offline');supervisor.stop()},stop(){stopped++},async drain(){drained++}};
 supervisor=createIngestionSupervisor({worker,pollMs:100,maxBackoffMs:1000,onError:()=>{},sleep:async ms=>{waits.push(ms)}});
 await supervisor.start();await supervisor.shutdown();
 assert.equal(calls,2);assert.equal(waits[0],100);assert.equal(stopped,1);assert.equal(drained,1);
});
test('supervisor stops without polling again and drains tasks',async()=>{
 let calls=0,drained=false;let supervisor;
 const worker={async tick(){calls++;supervisor.stop()},stop(){},async drain(){drained=true}};
 supervisor=createIngestionSupervisor({worker});
 await supervisor.start();await supervisor.shutdown();
 assert.equal(calls,1);assert.equal(drained,true);
});
test('supervisor validates intervals and worker interface',()=>{
 assert.throws(()=>createIngestionSupervisor({worker:{}}),/Invalid worker/);
 assert.throws(()=>createIngestionSupervisor({worker:{tick(){},stop(){},drain(){}},pollMs:0}),/Invalid polling intervals/);
});
