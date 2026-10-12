'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {PROJECT,matchesProject}=require('./agent-operations-project');
const {taskDiagnostic}=require('./agent-operations-diagnostics');
const {SMOKE,isSmoke,validSmokeResult}=require('./agent-operations-smoke');
const {SPECIALIST,isSpecialist,specialistScope,validArtifacts,evidenceHash}=require('./agent-operations-specialist');
const {QA,isQA,validSource,sourceFor,validVerdict}=require('./agent-operations-qa');
const ef=require('./agent-operations-evidence-first'),vm=require('./agent-operations-visual-model');
const KEY='agentops:{preview}:v1:ledger';
const CAS="local v=redis.call('GET',KEYS[1]) or ''; if v~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
const LIMITS=Object.freeze({tasks:32,events:100,attempts:2,calls:10,durationMs:600000,leaseMs:30000,taskMicros:5000000,cumulativeMicros:15000000,dayMicros:15000000,monthMicros:15000000,mockMicros:5000000,callMicros:300000});
const STAGES=Object.freeze(['chief','inspect','review','report']);
const TERMINAL=new Set(['verified','failed','cancelled','blocked']);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function redact(value){
  const clean=text=>text.replace(/\bsk-[A-Za-z0-9_-]{12,}/g,'[REDACTED]').replace(/\bBearer\s+[A-Za-z0-9._-]{12,}/gi,'Bearer [REDACTED]');
  if(typeof value==='string')return clean(value);
  if(Array.isArray(value))return value.map(redact);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v)]));
  return value;
}
function initial(){return {version:1,revision:0,tasks:[],reservations:[]};}
function check(value,message){if(!value)throw new Error(message);}
function event(t,type,now,details={}){check(t.events.length<LIMITS.events,'Audit capacity reached');t.events.push({sequence:t.events.length+1,type,at:now,...details});t.revision++;t.updatedAt=now;}
function fence(t,c,now){check(t.status==='running'&&t.fence===c.fence&&t.leaseUntil>now&&t.deadline>now,'Execution no longer authorized');}
function validate(s){check(s&&s.version===1&&Number.isSafeInteger(s.revision)&&Array.isArray(s.tasks)&&s.tasks.length<=LIMITS.tasks&&Array.isArray(s.reservations),'Invalid durable state');}
function createStore(adapter,{clock=Date.now,scope}={}){
  check(scope&&/^[a-f0-9]{40}$/.test(scope.commit)&&/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(scope.origin),'Invalid pinned Preview scope');
  const pinned=Object.freeze({...scope,paths:['/industries/legal','/#pricing']});
  async function read(){const raw=await adapter.read();if(raw===null)return initial();const s=JSON.parse(raw);validate(s);return s;}
  async function transact(fn){
    for(let n=0;n<5;n++){
      const raw=await adapter.read(),s=raw===null?initial():JSON.parse(raw);validate(s);
      const result=fn(s,clock());s.revision++;
      const next=JSON.stringify(s);check(Buffer.byteLength(next)<=1000000,'Ledger capacity reached');
      // Retry only a confirmed CAS conflict, never an uncertain storage failure.
      if(await adapter.compare(raw,next))return result;
    }
    throw new Error('Concurrent update; refresh and retry');
  }
  async function create({principal,idempotencyKey,objective,mode='mock',approval=null}){
    check(typeof principal==='string'&&principal.length<=200&&principal.length>0,'Invalid principal');
    check(typeof idempotencyKey==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(idempotencyKey),'Invalid request identity');
    check(typeof objective==='string'&&objective.trim().length>0&&objective.length<=1000,'Invalid objective');
    check(mode==='mock'||mode==='pilot','Invalid mode');
    if(mode==='pilot')check(matchesProject(approval)&&approval?.authorized===true&&approval.id&&Number.isSafeInteger(approval.expiresAt)&&approval.expiresAt>clock()&&approval.scopeHash===hash(pinned),'Pilot approval required');
    check(approval?.profile===undefined||mode==='pilot'&&(isSmoke(approval)||isSpecialist(approval)||isQA(approval)||ef.isEF(approval)),'Invalid execution profile');
    const smoke=mode==='pilot'&&isSmoke(approval);
    const specialist=mode==='pilot'&&isSpecialist(approval),first=mode==='pilot'&&ef.isEF(approval),qa=mode==='pilot'&&(isQA(approval)||first),profile=first?ef.profile(approval):smoke?SMOKE:specialist?SPECIALIST:qa?QA:null;
    if(first)check(approval.evaluationHash===ef.EF.evaluationHash,'Invalid evaluation identity');if(vm.isHybrid(approval))check(vm.approvalIdentity(approval),'Hybrid model approval mismatch');
    if(qa)check(specialistScope(pinned)&&approval.sourceTaskId===QA.sourceTaskId&&approval.findingsHash===QA.findingsHash&&approval.evidenceHash===QA.evidenceHash&&approval.maxMicros===profile.maxMicros&&approval.maxCalls===profile.calls&&approval.expiresAt<=clock()+LIMITS.durationMs&&objective===profile.objective,'Invalid QA approval');
    if(smoke)check(approval.maxMicros===SMOKE.maxMicros&&approval.maxCalls===SMOKE.calls&&approval.expiresAt<=clock()+LIMITS.durationMs&&objective===SMOKE.objective,'Invalid smoke approval');
    if(specialist)check(specialistScope(pinned)&&approval.maxMicros===SPECIALIST.maxMicros&&approval.maxCalls===SPECIALIST.calls&&approval.expiresAt<=clock()+LIMITS.durationMs&&objective===SPECIALIST.objective,'Invalid specialist approval');
    const fingerprint=hash({principal,idempotencyKey}),payload=hash({objective,mode,scope:pinned,...(profile?{profile:profile.profile}:{})});
    return transact((s,now)=>{
      if(principal.startsWith('mock-verifier:'))check(!s.verificationRevocations?.includes(principal.slice('mock-verifier:'.length)),'Mock verification closed');
      const old=s.tasks.find(t=>t.requestHash===fingerprint);
      if(old){check(old.payloadHash===payload,'Idempotency request mismatch');return old;}
      check(s.tasks.length<LIMITS.tasks,'Task capacity reached');
      if(mode==='pilot')check(!s.tasks.some(t=>t.approvalId===approval.id),'Approval already used');
      const source=qa?sourceFor(s.tasks.find(t=>t.id===QA.sourceTaskId)):null;
      if(qa)check(source,'Original QA source mismatch');
      const t={id:randomUUID(),requestHash:fingerprint,payloadHash:payload,principal,objective:redact(objective.trim()),mode,...(mode==='pilot'?PROJECT:{}),...(profile?{profile:profile.profile}:{}),...(vm.isHybrid(approval)?{modelConfig:vm.identity()}:{}),scope:pinned,approvalId:approval?.id||null,
        ...(qa?{source}:{}),...(first?{evidenceBinding:ef.binding(source),outcomes:{structural:'pending',integrity:'pending',substantive:'unassessed',finalAcceptance:'not-accepted',acceptedWork:false}}:{}),status:'assigned',stage:first?'observe':qa?'review':'chief',revision:0,fence:0,leaseUntil:0,createdAt:now,updatedAt:now,deadline:now+LIMITS.durationMs,
        attempts:0,calls:0,events:[],results:{},usage:[],costCeilingMicros:profile?profile.maxMicros:LIMITS.taskMicros};
      event(t,'assigned',now,{mode,...(qa?{sourceTaskId:QA.sourceTaskId,findingsHash:QA.findingsHash,evidenceHash:QA.evidenceHash}:{})});s.tasks.push(t);return t;
    });
  }
  async function command(id,c){return transact((s,now)=>{
    const t=s.tasks.find(t=>t.id===id);check(t,'Task not found');
    if(c.expectedRevision!==undefined)check(t.revision===c.expectedRevision,'Stale task revision');
    check(!TERMINAL.has(t.status),'Task is terminal');
    if((isQA(t)||ef.isEF(t))&&!['cancel','recover','fail'].includes(c.type))check(validSource(t.source)&&JSON.stringify(sourceFor(s.tasks.find(x=>x.id===QA.sourceTaskId)))===JSON.stringify(t.source),'Original QA source mismatch');
    if(c.type==='cancel'){t.status='cancelled';t.leaseUntil=0;event(t,'cancelled',now);return t;}
    if(c.type==='recover'){
      check(t.status==='running'&&t.leaseUntil<=now,'Lease still active');
      // Any unfinished paid attempt is uncertain, and must never be replayed.
      const pending=s.reservations.some(r=>r.taskId===id&&r.status==='pending');
      t.status=pending||t.mode==='pilot'||t.deadline<=now?'blocked':'assigned';t.leaseUntil=0;
      event(t,'interruption_recovered',now,{unknownOutcome:pending});return t;
    }
    check(t.deadline>now,'Execution deadline reached');
    if(c.type==='claim'){
      if(ef.isEF(t))check(t.costCeilingMicros===ef.profile(t).maxMicros&&(t.stage==='observe'&&t.calls===0||t.stage==='adjudicate'&&t.calls===1&&ef.validSeal(t.results.qaObservation,t)),'Execution no longer authorized');
      if(isQA(t))check(t.stage==='review'&&t.calls===0&&t.costCeilingMicros===QA.maxMicros,'Execution no longer authorized');
      if(isSpecialist(t))check(specialistScope(t.scope)&&['chief','inspect'].includes(t.stage)&&t.calls<SPECIALIST.calls,'Execution no longer authorized');
      check(t.status==='assigned','Task not queued');
      t.status='running';t.fence++;t.leaseUntil=Math.min(now+LIMITS.leaseMs,t.deadline);
      event(t,'claimed',now,{stage:t.stage,fence:t.fence});return t;
    }
    fence(t,c,now);
    if(c.type==='heartbeat'){t.leaseUntil=Math.min(now+LIMITS.leaseMs,t.deadline);event(t,'heartbeat',now);return t;}
    if(c.type==='reserve'){
      if(ef.isEF(t))check(t.mode==='pilot'&&(t.stage==='observe'&&t.calls===0||t.stage==='adjudicate'&&t.calls===1&&ef.validSeal(t.results.qaObservation,t)),'Execution no longer authorized');
      if(isQA(t))check(t.mode==='pilot'&&t.stage==='review'&&t.calls===0&&t.costCeilingMicros===QA.maxMicros,'Execution no longer authorized');
      check(t.calls<(ef.isEF(t)?ef.EF.calls:isSmoke(t)?SMOKE.calls:isSpecialist(t)?SPECIALIST.calls:isQA(t)?QA.calls:LIMITS.calls),'Call limit reached');
      if(isSmoke(t))check(t.mode==='pilot'&&t.stage==='chief'&&t.costCeilingMicros===SMOKE.maxMicros,'Execution no longer authorized');
      if(isSpecialist(t))check(t.mode==='pilot'&&specialistScope(t.scope)&&t.costCeilingMicros===SPECIALIST.maxMicros&&(['chief','inspect'][t.calls]===t.stage)&&(!t.calls||t.results.chief?.delegate==='website-visual-qa'),'Execution no longer authorized');
      check(typeof c.executionId==='string'&&/^exec_[a-zA-Z0-9_-]{1,80}$/.test(c.executionId),'Invalid execution identity');
      check(!s.reservations.some(r=>r.executionId===c.executionId),'Execution already reserved');
      const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7);
      const callMicros=vm.isHybrid(t)?vm.HYBRID.callMicros:LIMITS.callMicros;const spent=predicate=>(t.mode==='pilot'?require('./agent-operations-budget').paidReservations(s):s.reservations).filter(r=>r.mode===t.mode&&predicate(r)).reduce((n,r)=>n+r.ceilingMicros,0);
      check(spent(r=>r.taskId===id)+callMicros<=(ef.isEF(t)?ef.profile(t).maxMicros:isSmoke(t)?SMOKE.maxMicros:isSpecialist(t)?SPECIALIST.maxMicros:isQA(t)?QA.maxMicros:LIMITS.taskMicros),'Task budget exhausted');
      if(t.mode==='pilot')check(require('./agent-operations-budget').accounting(s).retainedMicros+callMicros<=LIMITS.cumulativeMicros,'Cumulative budget exhausted');
      check(spent(r=>r.day===day)+callMicros<=(t.mode==='pilot'?LIMITS.dayMicros:LIMITS.mockMicros),'Daily budget exhausted');
      check(spent(r=>r.month===month)+callMicros<=(t.mode==='pilot'?LIMITS.monthMicros:LIMITS.mockMicros),'Monthly budget exhausted');
      const r={executionId:c.executionId,taskId:id,mode:t.mode,...(t.mode==='pilot'?PROJECT:{}),...(vm.isHybrid(t)?{modelConfig:vm.identity()}:{}),stage:t.stage,fence:t.fence,day,month,ceilingMicros:callMicros,status:'pending',at:now};
      s.reservations.push(r);t.calls++;event(t,'execution_reserved',now,{executionId:r.executionId,stage:t.stage,ceilingMicros:r.ceilingMicros});return r;
    }
    if(c.type==='evidence'){
      const r=s.reservations.find(r=>r.executionId===c.executionId&&r.taskId===id&&r.fence===c.fence&&r.stage===t.stage&&r.status==='pending');check(r,'Execution receipt missing');
      r.evidence??=[];check(r.evidence.length<8,'Evidence capacity reached');r.evidence.push({at:now,...taskDiagnostic(c.diagnostic,t)});return t;
    }
    if(c.type==='finish'){
      const r=s.reservations.find(r=>r.executionId===c.executionId&&r.taskId===id&&r.fence===c.fence&&r.stage===t.stage&&r.status==='pending');check(r,'Execution receipt missing');
      check(c.result&&typeof c.result==='object'&&!Array.isArray(c.result)&&Buffer.byteLength(JSON.stringify(c.result))<=(vm.isHybrid(t)?24000:12000),'Invalid result');
      check(Number.isSafeInteger(c.actualMicros)&&c.actualMicros>=0&&c.actualMicros<=r.ceilingMicros,'Usage exceeds reservation');
      if(t.mode==='mock')check(c.actualMicros===0&&(!c.model||c.model==='mock'),'Mock mode cannot report paid usage');
      else if(vm.isHybrid(t))check(matchesProject(t)&&matchesProject(r)&&matchesProject(c)&&JSON.stringify(t.modelConfig)===JSON.stringify(vm.identity())&&JSON.stringify(r.modelConfig)===JSON.stringify(vm.identity())&&c.model===vm.HYBRID.model&&c.diagnostic?.usageValidated===true&&c.diagnostic.providerStatus==='completed'&&c.diagnostic.serviceTier==='default'&&c.diagnostic.cachedInputTokens===0&&c.diagnostic.cacheWriteTokens===0&&c.diagnostic.inputTokens===c.inputTokens&&c.diagnostic.outputTokens===c.outputTokens&&c.actualMicros===vm.usageCost(t,c.inputTokens,c.outputTokens),'Unverified hybrid usage');
      else check(matchesProject(t)&&matchesProject(r)&&matchesProject(c)&&c.model==='gpt-4.1-2025-04-14'&&Number.isSafeInteger(c.inputTokens)&&c.inputTokens>=0&&c.inputTokens<=100000&&Number.isSafeInteger(c.outputTokens)&&c.outputTokens>=0&&c.outputTokens<=1500&&c.actualMicros===c.inputTokens*2+c.outputTokens*8,'Unverified pilot usage');
      check(c.result.stage===t.stage,'Wrong specialist result');
      if(isSpecialist(t)){
        const keys=t.stage==='chief'?['stage','delegate','note']:['stage','note','findings','evidenceHash','artifacts'];
        check(['chief','inspect'].includes(t.stage)&&Object.keys(c.result).every(k=>keys.includes(k))&&typeof c.result.note==='string'&&c.result.note.length<=2000,'Invalid specialist result');
        if(t.stage==='inspect')check(Array.isArray(c.result.findings)&&c.result.findings.every(f=>f&&Object.keys(f).length===2&&typeof f.code==='string'&&f.code.length<=80&&typeof f.note==='string'&&f.note.length<=1000),'Invalid specialist findings');
      }
      if(isSmoke(t))check(t.mode==='pilot'&&t.stage==='chief'&&validSmokeResult(c.result)&&c.outputTokens<=SMOKE.outputTokens,'Invalid smoke result');
      else if(t.stage==='chief')check(c.result.delegate==='website-visual-qa','Invalid delegation');
      if(t.stage==='inspect'){
        check(Array.isArray(c.result.findings)&&c.result.findings.length<=8&&/^[a-f0-9]{64}$/.test(c.result.evidenceHash),'Missing visual evidence');t.attempts++;
        if(isSpecialist(t))check(t.calls===2&&t.results.chief?.delegate==='website-visual-qa'&&t.results.chief.executionId!==c.executionId&&validArtifacts(c.result.artifacts,c.executionId,r.at,now)&&c.result.evidenceHash===evidenceHash(c.result.artifacts),'Invalid fresh specialist evidence');
      }
      if(isQA(t))check(t.calls===1&&validVerdict(c.result,t.source),'Invalid independent QA verdict');
      if(ef.isEF(t))check(t.stage==='observe'?t.calls===1&&ef.validObservation(c.result,t.evidenceBinding):t.stage==='adjudicate'&&t.calls===2&&ef.validAdjudication(c.result,{...t,claims:ef.claims(t.source,vm.isHybrid(t))}),'Invalid evidence-first output');
      if(t.stage==='review'&&!isQA(t)){
        check(typeof c.result.accepted==='boolean'&&c.result.evidenceHash===t.results.inspect.evidenceHash,'Review evidence mismatch');
        check(c.executionId!==t.results.inspect.executionId,'Independent execution required');
      }
      r.status='settled';r.actualMicros=c.actualMicros;if(c.diagnostic)r.diagnostic=taskDiagnostic(c.diagnostic,t);
      t.usage.push({...(t.mode==='pilot'?PROJECT:{}),...(vm.isHybrid(t)?{modelConfig:vm.identity()}:{}),executionId:r.executionId,stage:t.stage,actualMicros:c.actualMicros,ceilingMicros:r.ceilingMicros,model:c.model||'mock',inputTokens:c.inputTokens||0,outputTokens:c.outputTokens||0});
      if(ef.isEF(t)){
        if(t.stage==='observe'){check(!t.results.qaObservation,'Observation already sealed');const result=redact(c.result);check(ef.validObservation(result,t.evidenceBinding),'Observation redaction invalid');t.results.qaObservation=ef.seal(result,t,c.executionId);if(vm.isHybrid(t))t.observationAssessment=require('./agent-operations-hybrid').observationAssessment(result,t.evidenceBinding,require('../data/agent-operations-reproduction-geometry.json'),t.scope);t.outcomes={structural:'observation-passed',integrity:'passed',substantive:'unassessed',finalAcceptance:'not-accepted',acceptedWork:false};event(t,'observation_sealed',now,{hash:t.results.qaObservation.hash,evidenceHash:t.evidenceBinding.evidenceHash,executionId:c.executionId});t.stage='adjudicate';t.status='assigned';}
        else {t.results.qaClaimVerdicts={...redact(c.result),executionId:c.executionId,observationHash:t.results.qaObservation.hash,evidenceReferences:structuredClone(t.evidenceBinding.images)};t.outcomes=ef.assess(c.result,t);t.status='verified';event(t,'acceptance_recorded',now,{substantive:t.outcomes.substantive,finalAcceptance:t.outcomes.finalAcceptance,acceptedWork:false,executionId:c.executionId});}
        event(t,'stage_completed',now,{stage:r.stage,executionId:c.executionId});t.leaseUntil=0;return t;
      }
      t.results[isQA(t)?'qaVerdict':t.stage]={...redact(c.result),executionId:c.executionId};event(t,'stage_completed',now,{stage:t.stage,executionId:c.executionId});
      if(isSmoke(t)||isQA(t))t.status='verified';
      else if(isSpecialist(t)&&t.stage==='inspect')t.status='verified';
      else if(t.stage==='report')t.status=t.results.review.accepted?'verified':'failed';
      else if(t.stage==='review'&&!c.result.accepted){
        if(t.attempts<LIMITS.attempts&&t.calls+3<=LIMITS.calls){t.stage='inspect';t.status='assigned';event(t,'rework_requested',now);}
        else {t.stage='report';t.status='assigned';}
      }else {t.stage=STAGES[STAGES.indexOf(t.stage)+1];t.status='assigned';}
      t.leaseUntil=0;return t;
    }
    if(c.type==='fail'){
      if(ef.isEF(t))t.outcomes={...t.outcomes,structural:c.diagnostic?.phase==='provider_output'?'failed':'unconfirmed',substantive:'unassessed',finalAcceptance:'not-accepted',acceptedWork:false};
      if(c.executionId!==undefined)check(/^exec_[a-zA-Z0-9_-]{1,80}$/.test(c.executionId),'Invalid execution identity');
      // A provider/tool exception may have incurred cost; preserve its reservation.
      t.status='blocked';t.leaseUntil=0;event(t,'execution_blocked',now,{code:'EXECUTION_UNCONFIRMED',...(c.executionId?{executionId:c.executionId}:{}),...(c.diagnostic?{diagnostic:taskDiagnostic(c.diagnostic,t)}:{})});return t;
    }
    throw new Error('Unsupported command');
  });}
  const verificationRevoked=async nonce=>(await read()).verificationRevocations?.includes(nonce)||false;
  const revokeVerification=nonce=>transact(s=>{check(/^[a-f0-9]{24}$/.test(nonce),'Invalid verification identity');s.verificationRevocations??=[];if(!s.verificationRevocations.includes(nonce)){check(s.verificationRevocations.length<32,'Verification capacity reached');s.verificationRevocations.push(nonce);}return true;});
  return {read,create,command,verificationRevoked,revokeVerification,scope:pinned};
}
function redisAdapter(kv){return {
  async read(){const v=await kv.get(KEY);return v==null?null:typeof v==='string'?v:JSON.stringify(v);},
  async compare(before,after){const r=Number(await kv.eval(CAS,[KEY],[before||'',after]));check(r===0||r===1,'Uncertain storage result');return r===1;}
};}
module.exports={createStore,redisAdapter,KEY,CAS,LIMITS,STAGES,TERMINAL,hash,redact};
