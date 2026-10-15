import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWork,mergeWorks,searchResearch} from '../src/research-providers.mjs';
test('OpenAlex and Crossref share normalized DOI identity',()=>{
 const a=normalizeWork('openalex',{id:'https://openalex.org/W1',display_name:'Mathematical paper',doi:'https://doi.org/10.1234/ABC',publication_year:2024,authorships:[{author:{display_name:'A B'}}]});
 const b=normalizeWork('crossref',{DOI:'10.1234/abc',title:['Mathematical paper'],published:{'date-parts':[[2024]]},author:[{given:'A',family:'B'}]});
 assert.equal(mergeWorks([a,b]).length,1);
 assert.equal(a.verification,'unverified');
});
test('OpenAlex search is read-only and normalizes mocked response',async()=>{
 let requested;const results=await searchResearch('openalex','torus diffusion',{limit:2,fetcher:async(url)=>{requested=url;return {ok:true,json:async()=>({results:[{id:'https://openalex.org/W2',display_name:'Torus model',publication_year:2023}]})}}});
 assert.match(requested,/api\.openalex\.org\/works/);assert.equal(results[0].title,'Torus model');
});
test('Crossref search validates limits and provider errors',async()=>{
 await assert.rejects(searchResearch('crossref','math',{fetcher:async()=>({ok:false,status:429})}),/429/);
 await assert.rejects(searchResearch('crossref','math',{limit:100}),/Invalid search/);
 assert.throws(()=>normalizeWork('unknown',{}));
});
