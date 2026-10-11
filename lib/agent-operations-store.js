'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {PROJECT,matchesProject}=require('./agent-operations-project');
const KEY='agentops:{preview}:v1:ledger';
const CAS="local v=redis.call('GET',KEYS[1]) or ''; if v~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";
const LIMITS=Object.freeze({tasks:32,events:100,attempts:2,calls:6,durationMs:600000,leaseMs:30000,taskMicros:2000000,dayMicros:2000000,monthMicros:2000000,callMicros:300000});
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
    const fingerprint=hash({principal,idempotencyKey}),payload=hash({objective,mode,scope:pinned});
    return transact((s,now)=>{
      if(principal.startsWith('mock-verifier:'))check(!s.verificationRevocations?.includes(principal.slice('mock-verifier:'.length)),'Mock verification closed');
      const old=s.tasks.find(t=>t.requestHash===fingerprint);
      if(old){check(old.payloadHash===payload,'Idempotency request mismatch');return old;}
      check(s.tasks.length<LIMITS.tasks,'Task capacity reached');
      if(mode==='pilot')check(!s.tasks.some(t=>t.approvalId===approval.id),'Approval already used');
      const t={id:randomUUID(),requestHash:fingerprint,payloadHash:payload,principal,objective:redact(objective.trim()),mode,...(mode==='pilot'?PROJECT:{}),scope:pinned,approvalId:approval?.id||null,
        status:'assigned',stage:'chief',revision:0,fence:0,leaseUntil:0,createdAt:now,updatedAt:now,deadline:now+LIMITS.durationMs,
        attempts:0,calls:0,events:[],results:{},usage:[],costCeilingMicros:LIMITS.taskMicros};
      event(t,'assigned',now,{mode});s.tasks.push(t);return t;
    });
  }
  async function command(id,c){return transact((s,now)=>{
    const t=s.tasks.find(t=>t.id===id);check(t,'Task not found');
    if(c.expectedRevision!==undefined)check(t.revision===c.expectedRevision,'Stale task revision');
    check(!TERMINAL.has(t.status),'Task is terminal');
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
      check(t.status==='assigned','Task not queued');
      t.status='running';t.fence++;t.leaseUntil=Math.min(now+LIMITS.leaseMs,t.deadline);
      event(t,'claimed',now,{stage:t.stage,fence:t.fence});return t;
    }
    fence(t,c,now);
    if(c.type==='heartbeat'){t.leaseUntil=Math.min(now+LIMITS.leaseMs,t.deadline);event(t,'heartbeat',now);return t;}
    if(c.type==='reserve'){
      check(t.calls<LIMITS.calls,'Call limit reached');
      check(typeof c.executionId==='string'&&/^exec_[a-zA-Z0-9_-]{1,80}$/.test(c.executionId),'Invalid execution identity');
      check(!s.reservations.some(r=>r.executionId===c.executionId),'Execution already reserved');
      const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7);
      const spent=predicate=>s.reservations.filter(r=>r.mode===t.mode&&predicate(r)).reduce((n,r)=>n+r.ceilingMicros,0);
      check(spent(r=>r.taskId===id)+LIMITS.callMicros<=LIMITS.taskMicros,'Task budget exhausted');
      check(spent(r=>r.day===day)+LIMITS.callMicros<=LIMITS.dayMicros,'Daily budget exhausted');
      check(spent(r=>r.month===month)+LIMITS.callMicros<=LIMITS.monthMicros,'Monthly budget exhausted');
      const r={executionId:c.executionId,taskId:id,mode:t.mode,...(t.mode==='pilot'?PROJECT:{}),stage:t.stage,fence:t.fence,day,month,ceilingMicros:LIMITS.callMicros,status:'pending',at:now};
      s.reservations.push(r);t.calls++;event(t,'execution_reserved',now,{executionId:r.executionId,stage:t.stage,ceilingMicros:r.ceilingMicros});return r;
    }
    if(c.type==='finish'){
      const r=s.reservations.find(r=>r.executionId===c.executionId&&r.taskId===id&&r.fence===c.fence&&r.stage===t.stage&&r.status==='pending');check(r,'Execution receipt missing');
      check(c.result&&typeof c.result==='object'&&!Array.isArray(c.result)&&Buffer.byteLength(JSON.stringify(c.result))<=12000,'Invalid result');
      check(Number.isSafeInteger(c.actualMicros)&&c.actualMicros>=0&&c.actualMicros<=r.ceilingMicros,'Usage exceeds reservation');
      if(t.mode==='mock')check(c.actualMicros===0&&(!c.model||c.model==='mock'),'Mock mode cannot report paid usage');
      else check(matchesProject(t)&&matchesProject(r)&&matchesProject(c)&&c.model==='gpt-4.1-2025-04-14'&&Number.isSafeInteger(c.inputTokens)&&c.inputTokens>=0&&c.inputTokens<=100000&&Number.isSafeInteger(c.outputTokens)&&c.outputTokens>=0&&c.outputTokens<=1500&&c.actualMicros===c.inputTokens*2+c.outputTokens*8,'Unverified pilot usage');
      check(c.result.stage===t.stage,'Wrong specialist result');
      if(t.stage==='chief')check(c.result.delegate==='website-visual-qa','Invalid delegation');
      if(t.stage==='inspect'){
        check(Array.isArray(c.result.findings)&&c.result.findings.length<=8&&/^[a-f0-9]{64}$/.test(c.result.evidenceHash),'Missing visual evidence');t.attempts++;
      }
      if(t.stage==='review'){
        check(typeof c.result.accepted==='boolean'&&c.result.evidenceHash===t.results.inspect.evidenceHash,'Review evidence mismatch');
        check(c.executionId!==t.results.inspect.executionId,'Independent execution required');
      }
      r.status='settled';r.actualMicros=c.actualMicros;
      t.usage.push({...(t.mode==='pilot'?PROJECT:{}),executionId:r.executionId,stage:t.stage,actualMicros:c.actualMicros,ceilingMicros:r.ceilingMicros,model:c.model||'mock',inputTokens:c.inputTokens||0,outputTokens:c.outputTokens||0});
      t.results[t.stage]={...redact(c.result),executionId:c.executionId};event(t,'stage_completed',now,{stage:t.stage,executionId:c.executionId});
      if(t.stage==='report')t.status=t.results.review.accepted?'verified':'failed';
      else if(t.stage==='review'&&!c.result.accepted){
        if(t.attempts<LIMITS.attempts&&t.calls+3<=LIMITS.calls){t.stage='inspect';t.status='assigned';event(t,'rework_requested',now);}
        else {t.stage='report';t.status='assigned';}
      }else {t.stage=STAGES[STAGES.indexOf(t.stage)+1];t.status='assigned';}
      t.leaseUntil=0;return t;
    }
    if(c.type==='fail'){
      // A provider/tool exception may have incurred cost; preserve its reservation.
      t.status='blocked';t.leaseUntil=0;event(t,'execution_blocked',now,{code:'EXECUTION_UNCONFIRMED'});return t;
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
