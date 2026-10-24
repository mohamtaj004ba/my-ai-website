'use strict';
// An inert proposal for the independently reproduced product defect. Never run
// proposed source here; preserve the older one-chart profile and its records.
const original=require('./agent-operations-draft-correction');
const PROFILE='dashboard-local-days-v2';
const ROLLING='function withinDays(ts,days){return !!ts&&ts>=Date.now()-days*86400000}';
const HELPER='function nextLocalDayStart(date){const next=new Date(date);next.setDate(next.getDate()+1);return next.getTime()}';
const EDITS=Object.freeze([
 Object.freeze({beforeText:ROLLING,afterText:HELPER+'\n'+ROLLING}),
 Object.freeze({beforeText:original.BEFORE,afterText:'const next=nextLocalDayStart(d);'}),
 Object.freeze({beforeText:'const next=d.getTime()+86400000,n=rows.filter',afterText:'const next=nextLocalDayStart(d),n=rows.filter'})
]);
function proposal(text){
 if(original.hash(text)!==original.SOURCE_HASH||EDITS.some(e=>text.split(e.beforeText).length!==2))throw Error('CALENDAR_PROPOSAL_SOURCE_DRIFT');
 return{version:'engineering-text-proposal-v1',path:'dashboard.js',beforeSha256:original.SOURCE_HASH,edits:EDITS.map(e=>({...e}))};
}
function inspect(base,text){
 const p=proposal(text),lines=text.split('\n');
 return{...base,correctionProfile:PROFILE,observations:p.edits.slice(1).map((e,i)=>{const line=lines.findIndex(l=>l.includes(e.beforeText));return{id:i?'analytics-local-day-dst':'overview-local-day-dst',kind:'verified-deterministic-defect',title:(i?'Analytics':'Overview')+' daily chart uses elapsed 24 hours for a local calendar day',approach:'Use one shared next-local-midnight helper; preserve rolling-duration filters and unrelated KPIs.',benefit:'Avoid duplicated spring-day calls and omitted late fall-day calls.',evidence:{id:i?'analytics-local-day-dst':'overview-local-day-dst',path:p.path,line:line+1,text:lines[line],sha256:p.beforeSha256,excerptHash:original.hash(lines[line])},uncertainty:'Both actual source loops independently reproduced with fictional timestamps; customer occurrence and a CallerCore-owned hosted browser reproduction remain unverified.'};}),qualification:'Genuine exact deployed source, two independently reproduced chart defects, deterministic proposal reasoning. Proposed source remains inert; no live AI judgment or publication acceptance.'};
}
module.exports={PROFILE,EDITS,HELPER,ROLLING,proposal,inspect};
