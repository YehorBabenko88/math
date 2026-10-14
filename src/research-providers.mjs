// Read-only provider normalization. Network access is injected for testability.
const providers=new Set(['openalex','crossref','arxiv','semantic-scholar','wikidata']);
const text=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
export function normalizeWork(provider,record){
 if(!providers.has(provider)||!record||typeof record!=='object')throw Error('Unsupported provider or record');
 let title='',doi='',id='',year=null,authors=[];
 if(provider==='openalex'){title=text(record.display_name??record.title);doi=text(record.doi,300);id=text(record.id,300);year=record.publication_year;authors=(record.authorships??[]).map(a=>a.author?.display_name)}
 else if(provider==='crossref'){title=text(Array.isArray(record.title)?record.title[0]:record.title);doi=text(record.DOI,300);id=doi;year=record.published?.['date-parts']?.[0]?.[0]??null;authors=(record.author??[]).map(a=>[a.given,a.family].filter(Boolean).join(' '))}
 else if(provider==='semantic-scholar'){title=text(record.title);doi=text(record.externalIds?.DOI,300);id=text(record.paperId,300);year=record.year;authors=(record.authors??[]).map(a=>a.name)}
 else if(provider==='arxiv'){title=text(record.title);id=text(record.arxivId??record.id,300);year=record.year;authors=record.authors??[]}
 else {title=text(record.label??record.title);id=text(record.id,300);year=record.year;authors=record.authors??[]}
 doi=doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').toLowerCase();
 if(!title||!id&&!doi)throw Error('Missing work identity or title');
 if(year!==null&&(!Number.isInteger(year)||year<1500||year>2200))year=null;
 return {provider,sourceId:id,title,doi:doi||null,year,authors:authors.filter(a=>typeof a==='string').map(a=>text(a,200)).filter(Boolean).slice(0,100),verification:'unverified'};
}
export function mergeWorks(works){
 const byKey=new Map();
 for(const work of works){const key=work.doi?'doi:'+work.doi:work.provider+':'+work.sourceId;if(!byKey.has(key))byKey.set(key,{...work,sources:[{provider:work.provider,id:work.sourceId}]});else byKey.get(key).sources.push({provider:work.provider,id:work.sourceId})}
 return [...byKey.values()];
}
export async function searchResearch(provider,query,{fetcher=fetch,apiKey,mailto,limit=10}={}){
 if(!['openalex','crossref'].includes(provider))throw Error('Provider not yet connected');
 if(typeof query!=='string'||!query.trim()||query.length>200||!Number.isInteger(limit)||limit<1||limit>25)throw Error('Invalid search request');
 const url=new URL(provider==='openalex'?'https://api.openalex.org/works':'https://api.crossref.org/works');
 url.searchParams.set(provider==='openalex'?'search':'query',query);
 url.searchParams.set(provider==='openalex'?'per_page':'rows',String(limit));
 if(provider==='openalex'&&apiKey)url.searchParams.set('api_key',apiKey);
 if(provider==='crossref'&&mailto)url.searchParams.set('mailto',mailto);
 const response=await fetcher(url.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Research provider HTTP '+response.status);
 const payload=await response.json();
 const records=provider==='openalex'?payload.results:payload.message?.items;
 if(!Array.isArray(records))throw Error('Invalid provider response');
 return records.slice(0,limit).map(record=>normalizeWork(provider,record));
}
