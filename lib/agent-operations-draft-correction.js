'use strict';
// One reviewed inert calendar correction, not caller-supplied edits or executable code.
const {createHash}=require('node:crypto');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const PROFILE='dashboard-local-day-v1',BEFORE='const next=d.getTime()+86400000;',AFTER='const nextDay=new Date(d);nextDay.setDate(nextDay.getDate()+1);const next=nextDay.getTime();';
const SOURCE_HASH='441484e8a28273bb17eb0c1533b306935c30e00526a5cfc68a8e75b011fad5a6';
function apply(text){if(hash(text)!==SOURCE_HASH||text.split(BEFORE).length!==2)throw Error('DRAFT_PREIMAGE');return text.replace(BEFORE,AFTER);}
function patch(text){const after=apply(text);return{path:'dashboard.js',operation:'replace-reviewed-fixed-text',profile:PROFILE,beforeSha256:hash(text),afterSha256:hash(after),beforeText:BEFORE,afterText:AFTER};}
module.exports={PROFILE,BEFORE,AFTER,SOURCE_HASH,apply,patch,hash};
