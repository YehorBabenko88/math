// Typed scientific adapters: conversions are explicit, validated and traceable.
export const knowledgeDomains=Object.freeze({
 sets:{label:'Теория множеств',types:['implicit-region-2d']},
 geometry:{label:'Геометрия',types:['implicit-region-2d','raster-mask-2d']},
 physics:{label:'Физика и PDE',types:['raster-mask-2d','scalar-field-2d']},
 dynamics:{label:'Нелинейная динамика',types:['time-series','response-series']},
 statistics:{label:'Статистика',types:['time-series','response-series']}
});
export function createAdapterRegistry(){
 const adapters=new Map();
 return {
  register(adapter){
   if(!adapter||typeof adapter.id!=='string'||!/^[a-z][a-z0-9-]*$/.test(adapter.id)||!adapter.from||!adapter.to||typeof adapter.run!=='function'||adapters.has(adapter.id))throw Error('Invalid or duplicate adapter');
   adapters.set(adapter.id,Object.freeze({...adapter}));
  },
  list(){return [...adapters.values()].map(({id,from,to,description})=>({id,from,to,description}))},
  plan(sourceType,targetType){
   if(sourceType===targetType)return [];
   const queue=[{type:sourceType,path:[]}],visited=new Set([sourceType]);
   while(queue.length){const current=queue.shift();for(const adapter of adapters.values()){if(adapter.from!==current.type||visited.has(adapter.to))continue;const path=[...current.path,adapter.id];if(adapter.to===targetType)return path;visited.add(adapter.to);queue.push({type:adapter.to,path})}}
   throw Error('No compatible adapter path: '+sourceType+' → '+targetType);
  },
  execute(input,{from,to,context={}}){
   const path=this.plan(from,to),trace=[];let value=input;
   for(const id of path){const adapter=adapters.get(id);value=adapter.run(value,context);if(value===undefined||value===null)throw Error('Adapter returned empty result: '+id);trace.push({adapter:id,from:adapter.from,to:adapter.to})}
   return {value,trace,sourceType:from,targetType:to};
  }
 };
}
