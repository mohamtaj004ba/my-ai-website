'use strict';
// Owner-authorized development allowance. Per-task/model limits are separate and unchanged.
const DEVELOPMENT=Object.freeze({version:'owner-development-15usd-v1',cumulativeMicros:15000000,dayMicros:15000000,monthMicros:15000000});
const amount=n=>Number.isSafeInteger(n)&&n>=0;
function paidReservations(state){return[...(state.reservations||[]),...(state.operations?.reservations||[])].filter(r=>r.mode==='pilot');}
function accounting(state){const r=paidReservations(state);if(r.some(r=>!amount(r.ceilingMicros)||!['pending','settled'].includes(r.status)||r.actualMicros!==undefined&&(!amount(r.actualMicros)||r.actualMicros>r.ceilingMicros)))throw Error('Unverified accounting');const retainedMicros=r.reduce((n,r)=>n+r.ceilingMicros,0);if(!amount(retainedMicros))throw Error('Accounting overflow');return{...DEVELOPMENT,retainedMicros,remainingMicros:DEVELOPMENT.cumulativeMicros-retainedMicros,pendingMicros:r.filter(r=>r.status==='pending').reduce((n,r)=>n+r.ceilingMicros,0),knownSettledMicros:r.filter(r=>r.status==='settled').reduce((n,r)=>n+(r.actualMicros||0),0),basis:'all retained ceilings; settled token usage separate; not invoice reconciled'};}
module.exports={DEVELOPMENT,accounting,paidReservations};
