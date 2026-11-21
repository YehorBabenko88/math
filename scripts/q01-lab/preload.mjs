import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const config=JSON.parse(process.env.Q01_WORKER_CONFIG);
const queue=pathToFileURL(join(config.source,'src/book-ingestion/queue.mjs')).href;
registerHooks({resolve(specifier,context,next){
 if(context.parentURL===queue&&specifier==='node:sqlite')return {url:new URL('./sqlite-probe.mjs',import.meta.url).href,shortCircuit:true};
 if(context.parentURL===queue&&specifier==='node:fs')return {url:new URL('./fs-probe.mjs',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
