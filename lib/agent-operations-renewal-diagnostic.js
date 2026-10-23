'use strict';
// Closed, content-free progress markers. These never grant or renew authority.
const PHASES=Object.freeze(['scope-validation','owner-revalidation','ledger-transaction','owner-and-ledger-read','postcheck','complete']);
function sanitize(value){
 if(!value||typeof value!=='object'||Object.keys(value).sort().join(',')!=='elapsedMs,phase,phaseElapsedMs'||!PHASES.includes(value.phase)||![value.elapsedMs,value.phaseElapsedMs].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=600000)||value.phaseElapsedMs>value.elapsedMs)return null;
 return{phase:value.phase,elapsedMs:value.elapsedMs,phaseElapsedMs:value.phaseElapsedMs};
}
function trace(clock=Date.now){
 const started=clock();let phase=null,phaseStarted=started;
 return Object.freeze({report(next){if(PHASES.includes(next)){phase=next;phaseStarted=clock();}},snapshot(){const now=clock();return sanitize({phase,elapsedMs:Math.max(0,Math.min(600000,Math.floor(now-started))),phaseElapsedMs:Math.max(0,Math.min(600000,Math.floor(now-phaseStarted)))});}});
}
module.exports={PHASES,sanitize,trace};
