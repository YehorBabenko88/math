// Boundary snapshots for flat, inert protocol records, never arbitrary adapters.
import {types} from 'node:util';
export function inertRecord(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('inert data record required');
 const descriptors=Object.getOwnPropertyDescriptors(value),entries=[];
 for(const key of Reflect.ownKeys(descriptors)){
  const d=descriptors[key];if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value')||d.value!==null&&!['string','number','boolean','undefined'].includes(typeof d.value))throw Error('inert data record required');
  entries.push([key,d.value]);
 }
 return Object.freeze(Object.fromEntries(entries));
}
