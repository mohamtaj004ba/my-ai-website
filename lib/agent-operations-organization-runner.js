'use strict';
const {fork}=require('node:child_process'),{randomUUID}=require('node:crypto'),path=require('node:path'),{SPEC,hash}=require('./agent-operations-organization');
async function boundedAssessment(callback,input,deadline,signal){const controller=new AbortController();let rejectStop;const stopped=new Promise((_,reject)=>rejectStop=reject),abort=()=>{controller.abort();rejectStop(Error('Independent assessment cancelled or timed out'));},timer=setTimeout(abort,Math.max(1,Math.min(60000,deadline-Date.now())));signal?.addEventListener('abort',abort,{once:true});try{if(signal?.aborted||deadline<=Date.now()){abort();return await stopped;}return await Promise.race([Promise.resolve().then(()=>callback({...input,signal:controller.signal})),stopped]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}}
function isolated(dto,options={}){return new Promise((resolve,reject)=>{const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),entry=path.join(__dirname,'../scripts/agent-operations-organization-child.cjs'),allow=[entry,path.join(__dirname,'agent-operations-organization-fixtures.js'),path.join(__dirname,'../package.json')],child=fork(entry,[],{env,execArgv:['--permission',...allow.map(p=>'--allow-fs-read='+p)],silent:true});let done=false;const timer=setTimeout(()=>{child.kill();reject(Error('Isolated worker timeout'));},Math.min(SPEC[dto.stage].timeout,Math.max(1,dto.deadline-Date.now())));child.once('message',m=>{done=true;clearTimeout(timer);child.kill();m.error?reject(Error(m.error)):resolve(m.result);});child.once('exit',()=>{clearTimeout(timer);if(!done)reject(Error('Isolated worker interrupted'));});child.send({dto,options});});}
async function runMock(org,created,{reject=false}={}){
 const id=created.workflow.id,actor={workflowId:id,token:created.capability},captureActor={workflowId:id,token:created.captureCapability},assessor={workflowId:id,token:created.assessorCapability};let dto=await org.readWorkflow(actor,id);
 if(dto.mode!=='mock')throw Error('Mock runner cannot execute paid work');
 for(let n=0;n<5;n++){
  dto=await org.command(actor,id,{type:'claim',expectedRevision:dto.revision});const executionId='exec_'+randomUUID().replaceAll('-','');dto=await org.command(actor,id,{type:'reserve',expectedRevision:dto.revision,fence:dto.fence,executionId});
  try{
   if(dto.stage==='inspect'){const artifacts=require('./agent-operations-organization-fixtures').images(executionId,dto.scope,Date.now()),geometry={workflowId:id,executionId,sourceCommit:dto.scope.commit,provenance:'mock-fixture',results:['I3','I4'].map(imageId=>({imageId,headingOverlap:true,priceOverlap:false,priceGap:12}))};dto=await org.registerEvidence(captureActor,id,{expectedRevision:dto.revision,fence:dto.fence,executionId,artifacts,geometry});dto.capture={images:artifacts,geometry};}
   const result=await isolated(dto,{reject}),spec=SPEC[dto.stage];dto=await org.command(actor,id,{type:'finish',expectedRevision:dto.revision,fence:dto.fence,executionId,result,receipt:{model:spec.model,inputTokens:0,outputTokens:0,reasoningTokens:0,cacheReadTokens:0,cacheWriteTokens:0,actualMicros:0,providerStatus:'completed'}});
   if(dto.stage==='acceptance'){const a=await org.readAssessment(assessor,id);dto=await org.assess(assessor,id,{expectedRevision:a.revision,executionId:'exec_'+randomUUID().replaceAll('-',''),verdictHash:a.results.qa.hash,observationHash:a.results.observation.hash,evidenceHash:a.evidence.hash,accepted:!reject&&a.outcomes.substantive==='candidate',reason:reject?'Independent synthetic oracle rejects known overlap claim.':'Independent synthetic oracle confirms badge claim.'});}
  }catch(e){await org.command(actor,id,{type:'fail',expectedRevision:dto.revision,fence:dto.fence,requestAttempted:false,diagnostic:{errorType:'MockExecutionFailure'}});throw e;}
 }
 return dto;
}
// Future paid controller: no scheduler/retries/default credentials. Requires one fresh backend approval.
async function runApproved(org,created,{env,capture,independentAssessment,fetchImpl,signal}={}){
 if(created.workflow.mode!=='pilot'||typeof capture!=='function'||typeof independentAssessment!=='function')throw Error('Approved controller dependencies required');
 const id=created.workflow.id,actor={workflowId:id,token:created.capability},captureActor={workflowId:id,token:created.captureCapability},assessor={workflowId:id,token:created.assessorCapability};let dto=await org.readWorkflow(actor,id),images=[];
 for(let n=0;n<5;n++){
  dto=await org.command(actor,id,{type:'claim',expectedRevision:dto.revision});const executionId='exec_'+randomUUID().replaceAll('-','');let providerStarted=false;
  try{
   dto=await org.command(actor,id,{type:'reserve',expectedRevision:dto.revision,fence:dto.fence,executionId});
   if(dto.stage==='inspect'){
    // Keep lease alive during protected parent capture. No protection identity reaches browser/model.
    let captureError,pending=Promise.resolve();const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,Math.min(150000,dto.deadline-Date.now()));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();const heartbeat=setInterval(()=>{pending=pending.then(()=>org.command(actor,id,{type:'heartbeat',expectedRevision:dto.revision,fence:dto.fence})).then(d=>dto=d).catch(e=>{captureError=e;abort();});},10000);let captured;try{captured=await capture(dto.scope,{executionId,workflowId:id,collectGeometry:true,signal:controller.signal});}finally{clearInterval(heartbeat);clearTimeout(timer);signal?.removeEventListener('abort',abort);await pending;}if(captureError)throw captureError;
    images=captured.images.map(im=>({bytes:Buffer.from(im.dataUrl.slice('data:image/png;base64,'.length),'base64')}));const artifacts=captured.images.map((im,i)=>({id:'I'+(i+1),sha256:im.sha256,viewport:im.viewport,height:1000,capturedAt:im.capturedAt,executionId,sourceCommit:dto.scope.commit,provenance:'fresh-preview'}));dto=await org.registerEvidence(captureActor,id,{expectedRevision:dto.revision,fence:dto.fence,executionId,artifacts,geometry:captured.geometry});dto.capture={images:artifacts,geometry:captured.geometry};
   }
   const context=dto.stage==='chief'?await org.chiefContext(actor,id):undefined;
   providerStarted=true;dto=await require('./agent-operations-organization-provider').execute(dto,{env,executionId,images,context,fetchImpl,signal,broker:{command:command=>org.command(actor,id,command)}});
   if(dto.stage==='acceptance'){const a=await org.readAssessment(assessor,id),assessment=await boundedAssessment(independentAssessment,{workflow:structuredClone(a),images},dto.deadline,signal);dto=await org.assess(assessor,id,{expectedRevision:a.revision,executionId:'exec_'+randomUUID().replaceAll('-',''),verdictHash:a.results.qa.hash,observationHash:a.results.observation.hash,evidenceHash:a.evidence.hash,accepted:assessment.accepted,reason:assessment.reason});}
  }catch(error){try{const current=await org.readWorkflow(actor,id);if(current.stage==='acceptance'&&current.status==='assigned')await org.abortAssessment(assessor,id,{expectedRevision:current.revision});else if(current.status==='running')await org.command(actor,id,{type:'fail',expectedRevision:current.revision,fence:current.fence,requestAttempted:providerStarted?null:false,diagnostic:{phase:'orchestrator',errorType:'ValidationError',requestAttempted:providerStarted?null:false}});}catch{}throw error;}
 }
 return dto;
}
module.exports={isolated,runMock,runApproved,boundedAssessment};
