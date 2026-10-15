import test from 'node:test';
import assert from 'node:assert/strict';
import {startIngestionService} from '../src/ingestion-service.mjs';
test('service refuses to start without database configuration',async()=>{
 await assert.rejects(startIngestionService({env:{}}),/DATABASE_URL is required/);
});
test('service connects, polls and closes injected PostgreSQL pool',async()=>{
 let ended=0,queries=0;
 class Pool{
  async query(sql){queries++;if(sql==='SELECT 1')return {rows:[{one:1}]};return {rows:[]}}
  async end(){ended++}
 }
 const service=await startIngestionService({
  env:{MATH_UNIVERSE_DATABASE_URL:'postgres://local/test',MATH_UNIVERSE_WORKER_ID:'test'},
  loadPg:async()=>({default:{Pool}}),handlers:{},onError:()=>{}
 });
 await service.stop();
 assert.equal(ended,1);assert.ok(queries>=1);
});
