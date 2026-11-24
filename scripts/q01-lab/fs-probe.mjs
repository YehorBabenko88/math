import * as fs from 'node:fs';
import {basename} from 'node:path';
import {barrier,diagnostic,emit,fault} from './probe.mjs';
export const mkdirSync=fs.mkdirSync,realpathSync=fs.realpathSync;
let missing=0;
export function lstatSync(...args){
 const kind=basename(String(args[0]));
 try{
  if(kind==='queue.sqlite')fault('fs-read');
  const result=fs.lstatSync(...args);
  if(/^queue\.sqlite(?:-journal|-wal|-shm)?$/.test(kind))emit('storage-stat',{kind,size:result.size,links:result.nlink,regular:result.isFile()});
  return result;
 }catch(error){
  diagnostic('lstat',error);
  if(error.code==='ENOENT'&&kind==='queue.sqlite'&&++missing===3)barrier('existence-missing-stat');
  throw error;
 }
}
