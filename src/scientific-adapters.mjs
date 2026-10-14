import {createAdapterRegistry} from './adapter-registry.mjs';
import {rasterizeDomain,initializePulse,diffusionStep} from './geometry-pde-adapter.mjs';
import {simulateOverlay} from './cross-domain.mjs';
export function createScientificRegistry(){
 const registry=createAdapterRegistry();
 registry.register({id:'region-to-grid',from:'implicit-region-2d',to:'raster-mask-2d',description:'Дискретизация геометрической области',run:(field,ctx)=>rasterizeDomain(field,ctx.grid||{})});
 registry.register({id:'grid-to-diffusion',from:'raster-mask-2d',to:'scalar-field-2d',description:'Диффузия примеси с непроницаемой границей',run:(grid,ctx)=>{let values=initializePulse(grid,ctx.pulse||{});const steps=ctx.steps??100;if(!Number.isInteger(steps)||steps<0||steps>10000)throw Error('Invalid simulation steps');for(let i=0;i<steps;i++)values=diffusionStep(grid,values,ctx.diffusion||{});return {grid,values,steps}}});
 registry.register({id:'series-to-landau',from:'time-series',to:'response-series',description:'Нелинейный отклик на нормализованный ряд',run:(series,ctx)=>simulateOverlay(series,ctx.overlay||{})});
 return registry;
}
