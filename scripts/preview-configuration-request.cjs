'use strict';
// Work-only pure request construction. No provider I/O, credentials, shell,
// publication authority, retries, or changes to the existing intent journal.
const a=require('node:assert/strict'),cfg=require('../lib/agent-operations-engineering-configuration');
function redeployment(record,metadata){
 cfg.status({engineeringConfigurationIntents:[record]},{binding:record.identity},record.id);
 a.equal(record.status,'claimed');a(record.expiresAt>Date.now());a.equal(record.executionAuthorized,false);
 a.equal(record.events.at(-1)?.step,'deploy');a.equal(record.events.at(-1)?.phase,'dispatch');
 a.deepEqual(metadata,{...cfg.SCOPE,sourceCommit:record.sourceCommit,deploymentId:record.originalRuntime.deploymentId,releaseHash:record.release.digest,verified:true});
 a.equal(record.originalRuntime.sourceCommit,record.sourceCommit);a.equal(record.originalRuntime.branch,cfg.SCOPE.branch);a.deepEqual(record.originalRuntime.release,record.release);
 a(/^dpl_[A-Za-z0-9]+$/.test(record.originalRuntime.deploymentId));
 // REST /v13/deployments uses an OMITTED target for Preview. The CLI's
 // --target preview spelling is not a supported REST target value.
 return{teamId:cfg.SCOPE.teamId,forceNew:'1',requestBody:{name:'my-ai-website',project:cfg.SCOPE.projectId,deploymentId:record.originalRuntime.deploymentId,withLatestCommit:false}};
}
module.exports={redeployment};
