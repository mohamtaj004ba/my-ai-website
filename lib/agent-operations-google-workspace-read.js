'use strict';
// Prepared boundary only. No default transport, credential lookup, OAuth promotion,
// route, registration, journal or operational tool grant exists in this module.
const {createHash}=require('node:crypto'),{isDeepStrictEqual:equal}=require('node:util');
const VERSION='google-workspace-read-preparation-v1',MAX_BYTES=32000;
const check=(v,c)=>{if(!v)throw Error(c);};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&equal(Object.keys(v).sort(),keys.slice().sort());
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_][A-Za-z0-9_@.-]{0,159}$/.test(v)&&!['primary','me','root'].includes(v);
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const datePart=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)===v;
const providerInstant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&datePart(v.slice(0,10))&&Number(v.slice(11,13))<24&&Number(v.slice(14,16))<60&&Number(v.slice(17,19))<60&&Number.isFinite(Date.parse(v));
function authority(v,now){
 check(exact(v,['kind','status','connectionStatus','binding','expiresAt','resources']),'GW_READ_AUTHORITY_DENIED');
 check(v.kind==='google-workspace-read-authority-v1'&&v.status==='resource-approved'&&v.connectionStatus==='confirmed-read-only'&&Number.isSafeInteger(v.expiresAt)&&v.expiresAt>now&&v.expiresAt<=now+600000,'GW_READ_AUTHORITY_DENIED');
 const b=v.binding;check(exact(b,['ownerHash','workspaceHash','subjectHash','taskId','sourceCommit','releaseHash','deploymentId','origin','connectionRevision'])&&[b.ownerHash,b.workspaceHash,b.subjectHash,b.releaseHash].every(sha)&&/^[a-f0-9]{40}$/.test(b.sourceCommit||'')&&/^dpl_[A-Za-z0-9]{1,100}$/.test(b.deploymentId||'')&&/^[A-Za-z0-9_-]{1,100}$/.test(b.taskId||'')&&Number.isSafeInteger(b.connectionRevision)&&b.connectionRevision>0&&/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(b.origin||''),'GW_READ_BINDING_DENIED');
 const r=v.resources;check(exact(r,['calendars','calendarTimeMin','calendarTimeMax','driveFiles','people'])&&[r.calendars,r.driveFiles,r.people].every(a=>Array.isArray(a)&&a.length<=8&&new Set(a).size===a.length)&&r.calendars.every(id)&&r.driveFiles.every(x=>id(x)&&!x.includes('@'))&&r.people.every(x=>typeof x==='string'&&/^people\/[A-Za-z0-9_-]{1,100}$/.test(x)&&x!=='people/me'),'GW_READ_RESOURCES_DENIED');check(instant(r.calendarTimeMin)&&instant(r.calendarTimeMax)&&Date.parse(r.calendarTimeMax)>Date.parse(r.calendarTimeMin)&&Date.parse(r.calendarTimeMax)-Date.parse(r.calendarTimeMin)<=86400000,'GW_READ_RESOURCES_DENIED');return v;
}
function request(input,grant){
 check(input&&typeof input==='object'&&!Array.isArray(input),'GW_READ_REQUEST_DENIED');let url;
 if(input.kind==='calendar'){
  check(exact(input,['kind','resource','timeMin','timeMax'])&&grant.resources.calendars.includes(input.resource)&&instant(input.timeMin)&&instant(input.timeMax)&&Date.parse(input.timeMax)>Date.parse(input.timeMin)&&Date.parse(input.timeMin)>=Date.parse(grant.resources.calendarTimeMin)&&Date.parse(input.timeMax)<=Date.parse(grant.resources.calendarTimeMax),'GW_READ_REQUEST_DENIED');
  url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(input.resource)+'/events?'+new URLSearchParams({timeMin:input.timeMin,timeMax:input.timeMax,maxResults:'10',singleEvents:'true',orderBy:'startTime',fields:'kind,items(id,status,start,end),nextPageToken'});
 }else if(input.kind==='drive'){
  check(exact(input,['kind','resource'])&&grant.resources.driveFiles.includes(input.resource),'GW_READ_REQUEST_DENIED');url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(input.resource)+'?'+new URLSearchParams({fields:'id,mimeType,size,modifiedTime,trashed'});
 }else if(input.kind==='person'){
  check(exact(input,['kind','resource'])&&grant.resources.people.includes(input.resource),'GW_READ_REQUEST_DENIED');url='https://people.googleapis.com/v1/'+input.resource+'?'+new URLSearchParams({personFields:'metadata',fields:'resourceName,metadata(deleted,sources(type))'});
 }else throw Error('GW_READ_REQUEST_DENIED');
 return{url,method:'GET',redirect:'error',headers:{Accept:'application/json'}};
}
function time(v){check(v&&typeof v==='object'&&!Array.isArray(v),'GW_READ_RESPONSE_DENIED');if(v.dateTime!==undefined){check(v.date===undefined&&providerInstant(v.dateTime),'GW_READ_RESPONSE_DENIED');return{dateTime:new Date(v.dateTime).toISOString()};}check(datePart(v.date),'GW_READ_RESPONSE_DENIED');return{date:v.date};}
function project(input,body){
 check(body&&typeof body==='object'&&!Array.isArray(body),'GW_READ_RESPONSE_DENIED');
 if(input.kind==='calendar'){
  check(body.nextPageToken===undefined||typeof body.nextPageToken==='string'&&body.nextPageToken.length<=2048,'GW_READ_RESPONSE_DENIED');
  check(body.kind==='calendar#events'&&(body.items===undefined||Array.isArray(body.items)&&body.items.length<=10),'GW_READ_RESPONSE_DENIED');return{items:(body.items||[]).map(e=>{check(e&&id(e.id)&&['confirmed','tentative','cancelled'].includes(e.status),'GW_READ_RESPONSE_DENIED');if(e.status==='cancelled'&&(!e.start||!e.end))return{eventHash:hash(e.id),status:e.status,start:null,end:null,timing:'unavailable-cancelled'};const start=time(e.start),end=time(e.end);check(Object.hasOwn(start,'date')===Object.hasOwn(end,'date'),'GW_READ_RESPONSE_DENIED');if(start.date){check(end.date>start.date,'GW_READ_RESPONSE_DENIED');return{eventHash:hash(e.id),status:e.status,start,end,timing:'calendar-local-date-only',overlap:'unverified-without-calendar-timezone'};}const from=Date.parse(start.dateTime),to=Date.parse(end.dateTime);check(to>from&&to>Date.parse(input.timeMin)&&from<Date.parse(input.timeMax),'GW_READ_RESPONSE_DENIED');return{eventHash:hash(e.id),status:e.status,start,end};}),truncated:typeof body.nextPageToken==='string'&&body.nextPageToken.length>0};
 }
 if(input.kind==='drive'){
  check(body.id===input.resource&&typeof body.mimeType==='string'&&body.mimeType.length<=120&&typeof body.trashed==='boolean'&&(body.modifiedTime===undefined||providerInstant(body.modifiedTime))&&(body.size===undefined||typeof body.size==='string'&&/^\d{1,16}$/.test(body.size)),'GW_READ_RESPONSE_DENIED');
  const kinds=new Map([['application/vnd.google-apps.document','document'],['application/vnd.google-apps.spreadsheet','spreadsheet'],['application/vnd.google-apps.folder','folder'],['application/pdf','pdf']]),kind=kinds.get(body.mimeType)||'other';return{kind,trashed:body.trashed,...(body.size!==undefined?{bytes:body.size}:{}),...(body.modifiedTime!==undefined?{modifiedAt:new Date(body.modifiedTime).toISOString()}:{})};
 }
 check(body.resourceName===input.resource&&body.metadata&&Array.isArray(body.metadata.sources)&&body.metadata.sources.length<=10&&(body.metadata.deleted===undefined||typeof body.metadata.deleted==='boolean'),'GW_READ_RESPONSE_DENIED');
 return{deleted:body.metadata.deleted===true,sourceTypes:body.metadata.sources.map(s=>{check(['ACCOUNT','PROFILE','DOMAIN_PROFILE','CONTACT','OTHER_CONTACT'].includes(s?.type),'GW_READ_RESPONSE_DENIED');return s.type;})};
}
function createPreparedRead({authorize,transport,clock=Date.now,timeoutMs=3000}={}){
 check(typeof authorize==='function'&&typeof transport==='function'&&Number.isSafeInteger(timeoutMs)&&timeoutMs>=20&&timeoutMs<=3000,'GW_READ_CONFIGURATION_REQUIRED');
 return Object.freeze({async inspect(input,{signal}={}){
  const c=new AbortController(),combined=signal?AbortSignal.any([signal,c.signal]):c.signal,timer=setTimeout(()=>c.abort(),timeoutMs);let listener;
  const work=async()=>{
   check(!combined.aborted,'GW_READ_CANCELLED');const captured=structuredClone(input),first=authority(await authorize('before'),clock()),sealed=structuredClone(first);const plan=request(captured,sealed);
   check(!combined.aborted,'GW_READ_CANCELLED');const response=await transport(plan.url,{method:plan.method,redirect:plan.redirect,headers:plan.headers,signal:combined});
   check(!combined.aborted,'GW_READ_CANCELLED');check(response?.ok===true&&!response.redirected&&(!response.url||response.url===plan.url)&&/^application\/json\b/i.test(response.headers?.get('content-type')||''),'GW_READ_PROVIDER_UNAVAILABLE');
   check(Number(response.headers.get('content-length')||0)<=MAX_BYTES,'GW_READ_RESPONSE_BOUNDS');let size=0;const parts=[];
   check(response.body&&typeof response.body.getReader==='function','GW_READ_RESPONSE_DENIED');const reader=response.body.getReader();try{while(true){check(!combined.aborted,'GW_READ_CANCELLED');const r=await reader.read();if(r.done)break;size+=r.value.byteLength;check(size<=MAX_BYTES,'GW_READ_RESPONSE_BOUNDS');parts.push(Buffer.from(r.value));}}finally{await reader.cancel().catch(()=>{});}
   const observation=project(captured,JSON.parse(Buffer.concat(parts).toString('utf8')));check(!combined.aborted,'GW_READ_CANCELLED');const after=authority(await authorize('after'),clock());check(equal(after,sealed),'GW_READ_AUTHORITY_CHANGED');check(!combined.aborted,'GW_READ_CANCELLED');
   const receipt={version:VERSION,kind:captured.kind,binding:sealed.binding,resourceHash:hash(captured.resource),requestHash:hash(captured),observedAt:clock(),observation,observationHash:hash(observation),operationalAuthority:false,publicationAllowed:false,qualification:'Prepared read boundary; offline transport fixtures do not establish a connected operational Google tool.'};return{...receipt,receiptHash:hash(receipt)};
  };
  try{return await Promise.race([work(),new Promise((_,reject)=>{listener=()=>reject(Error('GW_READ_CANCELLED'));if(combined.aborted)listener();else combined.addEventListener('abort',listener,{once:true});})]);}catch(error){const safe=new Set(['GW_READ_AUTHORITY_DENIED','GW_READ_BINDING_DENIED','GW_READ_RESOURCES_DENIED','GW_READ_REQUEST_DENIED','GW_READ_RESPONSE_DENIED','GW_READ_RESPONSE_BOUNDS','GW_READ_PROVIDER_UNAVAILABLE','GW_READ_AUTHORITY_CHANGED','GW_READ_CANCELLED']);throw Error(safe.has(error?.message)?error.message:'GW_READ_UNCONFIRMED');}finally{clearTimeout(timer);if(listener)combined.removeEventListener('abort',listener);c.abort();}
 }});
}
module.exports={VERSION,createPreparedRead};
