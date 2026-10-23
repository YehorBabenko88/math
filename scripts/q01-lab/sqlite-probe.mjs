import {DatabaseSync as Native} from 'node:sqlite';
import {barrier,diagnostic,fault,emit} from './probe.mjs';
let commits=0;
export function DatabaseSync(...args){
 emit('constructor-enter');let db;try{db=new Native(...args);emit('constructor-success');}catch(error){diagnostic('constructor',error);throw error;}
 barrier('constructor-after');
 return new Proxy(db,{get(target,key){
  if(key==='exec')return function(sql){
   const begin=sql.includes('BEGIN IMMEDIATE'),commit=sql==='COMMIT',remove=sql==='DELETE FROM jobs';
   if(begin)barrier('before-begin');
   if(commit)barrier('before-commit-'+(commits+1));
   try{const result=target.exec(sql);if(begin)barrier('after-begin');if(remove)barrier('after-delete');if(commit)barrier('after-commit-'+(++commits));return result;}catch(error){diagnostic('exec',error);throw error;}
  };
  if(key==='prepare')return function(sql){
   let statement;try{statement=target.prepare(sql);}catch(error){diagnostic('prepare',error);throw error;}
   return new Proxy(statement,{get(s,method){
    const value=s[method];if(typeof value!=='function')return value;
    return function(...values){try{if(method==='all'&&sql==='SELECT * FROM jobs ORDER BY createdAt,id')fault('sql-read');if(method==='run'&&sql.startsWith('INSERT INTO jobs'))fault('write-insert');const r=value.apply(s,values);if(method==='run'&&sql.startsWith('INSERT INTO jobs'))barrier('after-insert');return r;}catch(error){diagnostic('statement-'+String(method),error);throw error;}};
   }});
  };
  const value=target[key];if(typeof value!=='function')return value;
  return function(...values){try{return value.apply(target,values);}catch(error){diagnostic(String(key),error);throw error;}};
 }});
}
