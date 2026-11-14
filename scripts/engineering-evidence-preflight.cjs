'use strict';
// Local source/rehearsal synchronization check. Never generates evidence or authority.
function verify(){const rows=require('../lib/agent-operations-engineering-rehearsal').sourceEvidence(),release=require('../lib/agent-operations-contracts').assertRelease(),c=require('../lib/agent-operations-implementation').capabilities();if(c.publicationAuthorized!==false||c.boundedTasks.some(t=>t.paidExecution!==false||t.publicationAuthorized!==false||t.availability.executionAuthorized!==false))throw Error('Read-only capability contract required');return{sourceEvidenceVerified:true,evidenceIds:rows.map(e=>e.id),releaseHash:release.digest,executionAuthorized:false};}
if(require.main===module){try{console.log(JSON.stringify(verify()));}catch{console.error('Current engineering evidence does not match authenticated source. Prepare and review a new immutable evidence candidate before publication.');process.exitCode=1;}}
module.exports={verify};
