import {createAdapterRegistry} from './adapter-registry.mjs';
import {rasterizeDomain,initializePulse,diffusionStep} from './geometry-pde-adapter.mjs';
import {simulateOverlay} from './cross-domain.mjs';
import {embedSeriesOnTorus,recoverSeriesFromTorus,diffuseTorusSignal,compareSignal} from './torus-series.mjs';
import {torusGrid,torusInitialField,torusSurfaceStep,torusSurfaceMass} from './torus-surface-pde.mjs';
export function createScientificRegistry(){
 const registry=createAdapterRegistry();
 registry.register({id:'region-to-grid',from:'implicit-region-2d',to:'raster-mask-2d',description:'Дискретизация геометрической области',run:(field,ctx)=>rasterizeDomain(field,ctx.grid||{})});
 registry.register({id:'grid-to-diffusion',from:'raster-mask-2d',to:'scalar-field-2d',description:'Диффузия примеси с непроницаемой границей',run:(grid,ctx)=>{let values=initializePulse(grid,ctx.pulse||{});const steps=ctx.steps??100;if(!Number.isInteger(steps)||steps<0||steps>10000)throw Error('Invalid simulation steps');for(let i=0;i<steps;i++)values=diffusionStep(grid,values,ctx.diffusion||{});return {grid,values,steps}}});
 registry.register({id:'series-to-landau',from:'time-series',to:'response-series',description:'Нелинейный отклик на нормализованный ряд',run:(series,ctx)=>simulateOverlay(series,ctx.overlay||{})});
 registry.register({id:'series-to-torus',from:'time-series',to:'torus-embedding',description:'Index-preserving time-series encoding on a torus',run:(series,ctx)=>embedSeriesOnTorus(series,ctx.torus||{})});
 registry.register({id:'torus-to-smoothed-series',from:'torus-embedding',to:'transformed-time-series',description:'Cyclic diffusion along ordered samples and inverse mapping',run:(torus,ctx)=>{const original=recoverSeriesFromTorus(torus),filtered=diffuseTorusSignal(torus.points.map(p=>p.value),ctx.torusDiffusion||{}),transformed=recoverSeriesFromTorus(torus,{values:filtered});return {original,transformed,metrics:compareSignal(original,transformed),assumptions:['Diffusion acts along the 1D cyclic sample index, not across the torus surface']}}});
 registry.register({id:'torus-to-surface-diffusion',from:'torus-embedding',to:'torus-surface-field',description:'2D metric-aware conservative diffusion on a torus; synthetic initial pulse',run:(embedding,ctx)=>{const grid=torusGrid({...ctx.surfaceGrid,R:embedding.geometry.majorRadius,r:embedding.geometry.minorRadius});let field=torusInitialField(grid,ctx.surfacePulse||{});const initialMass=torusSurfaceMass(grid,field),steps=ctx.surfaceSteps??50;if(!Number.isInteger(steps)||steps<0||steps>5000)throw Error('Invalid surface steps');for(let i=0;i<steps;i++)field=torusSurfaceStep(grid,field,ctx.surfaceDiffusion||{});return {grid,field,steps,initialMass,finalMass:torusSurfaceMass(grid,field),assumptions:['Initial pulse is synthetic and is not inferred from the source time series']}}});
 return registry;
}
