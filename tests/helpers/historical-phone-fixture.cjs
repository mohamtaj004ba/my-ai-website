'use strict';
// Explicit offline replay of the frozen pre-fix task, never current-source
// qualification. Only opt-in test callbacks receive historical admission;
// source readers, production files and all other authorization remain intact.
const {createHash}=require('node:crypto');
const pins=Object.freeze({'dashboard.js':'37d1a7c38970ba3a82b3e3d97ac0aec12395dd5d6f8eb1e1fab51836f5a2de0c','lib/conversation-history.js':'1d36a9d0cf68e5d35c15e6d2df0c43557dd6e16d2ed05c2eb531164762406b23'});
let active=false;
async function withHistoricalPhoneSource(fn){
 if(!process.env.NODE_TEST_CONTEXT||typeof fn!=='function'||active)throw Error('HISTORICAL_PHONE_TEST_SCOPE');
 const phone=require('../../lib/agent-operations-phone-search'),s=phone.snapshot(),hash=x=>createHash('sha256').update(x).digest('hex');
 if(s.files.length!==2||s.files.some(f=>pins[f.path]!==f.sha256||hash(f.text)!==pins[f.path]))throw Error('HISTORICAL_PHONE_SOURCE_INTEGRITY');
 const availability=phone.availability,sourceEvidence=phone.sourceEvidence;active=true;
 phone.availability=()=>({status:'available-historical-offline-fixture',freshAssignmentAllowed:true,executionAuthorized:false});
 phone.sourceEvidence=()=>structuredClone(s.evidence);
 try{return await fn({qualification:'Explicit archived task replay, not current-product availability or live compatibility',sourceHashes:{...pins}});}finally{phone.availability=availability;phone.sourceEvidence=sourceEvidence;active=false;}
}
function historicalTest(nativeTest){return function(name,...args){const fn=args.pop();return nativeTest('Archived phone replay: '+name,...args,function(...values){return withHistoricalPhoneSource(()=>fn.apply(this,values));});};}
module.exports={withHistoricalPhoneSource,historicalTest,pins};
