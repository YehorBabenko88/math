// Controlled return of a real unlinked inode's Stats at the queue lstat boundary.
import {registerHooks} from 'node:module';
const config=JSON.parse(process.env.MU_DETACHED_STAT_CONFIG);
registerHooks({resolve(specifier,context,next){if(context.parentURL===config.queueURL&&specifier==='node:fs')return {url:new URL('./detached-journal-fs.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
