'use strict';
// Existing Vercel project, server OIDC only. No SDK automatic mutation retries,
// operator cookies, API-key copies, generic proxy or model-selected URL.
const {PROJECT}=require('./agent-operations-source-test-dispatch');
const TEAM='team_6Rg3DdCrvOml6oEGwx6Ndf1I';
const check=(v,c)=>{if(!v)throw Error(c);};
const diagnostics=require('./agent-operations-source-test-diagnostic'),{createHash}=require('node:crypto');
function create({env=process.env,fetchImpl=globalThis.fetch,token=()=>require('@vercel/functions/oidc').getVercelOidcToken()}={}){
 const local=()=>check(env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='feature/callercore-dashboards'&&(!env.VERCEL_PROJECT_ID||env.VERCEL_PROJECT_ID===PROJECT),'ENG_TEST_PROVIDER_AUTH');
 async function request(path,{method='GET',body,signal,missing=false,stream=false}={}){
  local();let credential;try{credential=await token();}catch{throw Error('ENG_TEST_PROVIDER_AUTH');}let claims;try{claims=JSON.parse(Buffer.from(credential.split('.')[1],'base64url').toString('utf8'));}catch{}
  check(claims?.project_id===PROJECT&&claims.owner_id===TEAM,'ENG_TEST_PROVIDER_AUTH');
  const url=new URL('https://vercel.com/api'+path);url.searchParams.set('teamId',TEAM);
  const response=await fetchImpl(url,{method,headers:{authorization:'Bearer '+credential,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(stream?150000:15000)])});
  if(missing&&response.status===404)return null;check(response.ok,'ENG_TEST_PROVIDER_HTTP');
  if(stream)return response;
  if(response.status===204)return{};
  const reader=response.body?.getReader();check(reader,'ENG_TEST_PROVIDER_RESULT');let bytes=0,parts=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;check(bytes<=128000,'ENG_TEST_PROVIDER_RESULT');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}
 }
 const sid=id=>{check(/^sbx_[A-Za-z0-9]+$/.test(id),'ENG_TEST_PROVIDER_SCOPE');return'/v2/sandboxes/sessions/'+id;};
 const normalize=raw=>{const {session,sandbox,routes=[]}=raw;check(session&&sandbox,'ENG_TEST_PROVIDER_RESULT');return{id:session.id,name:sandbox.name||session.sourceSandboxName,status:session.status,projectId:session.projectId,image:sandbox.image,vcpus:session.vcpus,memory:session.memory,timeout:session.timeout,persistent:sandbox.persistent,networkPolicy:session.networkPolicy,routes};};
 return{
  async metadata(){const raw=await request('/v2/sandboxes/sessions?project='+PROJECT+'&limit=1');check(Array.isArray(raw.sessions),'ENG_TEST_PROVIDER_RESULT');return{authenticated:true,projectId:PROJECT,teamId:TEAM,executionAuthorized:false,observedSessions:Array.isArray(raw.sessions)?raw.sessions.length:0};},
  async create(input,{signal}={}){const raw=await request('/v4/sandboxes',{method:'POST',body:input,signal});return normalize(raw);},
  async find(name){check(/^callercore-test-[a-f0-9]{32}$/.test(name),'ENG_TEST_PROVIDER_SCOPE');const raw=await request('/v2/sandboxes/'+name+'?projectId='+PROJECT+'&resume=false',{missing:true});return raw?normalize(raw):null;},
  async stop(id){await request(sid(id)+'/stop',{method:'POST',body:{}});},
  async read(id){const raw=await request(sid(id));return{id:raw.session?.id,status:raw.session?.status,projectId:raw.session?.projectId,name:raw.session?.sourceSandboxName};},
  async run(id,command,{signal,authorize}){
   const controller=new AbortController(),combined=AbortSignal.any([controller.signal,...(signal?[signal]:[])]);let checking=false;
   const interval=setInterval(()=>{if(checking)return;checking=true;Promise.resolve().then(authorize).catch(()=>controller.abort()).finally(()=>checking=false);},1000);
   try{
    await authorize();const response=await request(sid(id)+'/cmd',{method:'POST',body:{command:command.command,args:command.args,sudo:true,timeout:command.timeout,wait:true,logs:true},signal:combined,stream:true});
    check(response.headers.get('content-type')?.startsWith('application/x-ndjson'),'ENG_TEST_PROVIDER_RESULT');
    const reader=response.body?.getReader();check(reader,'ENG_TEST_PROVIDER_RESULT');const decoder=new TextDecoder();let pending='',stdout='',stderr='',bytes=0,finished=null,commandId=null;
    const facts=()=>diagnostics.sanitize({phase:'provider-stream',commandId,exitCode:finished,stdoutBytes:Buffer.byteLength(stdout),stdoutHash:createHash('sha256').update(stdout).digest('hex'),stderrBytes:Buffer.byteLength(stderr),stderrHash:createHash('sha256').update(stderr).digest('hex'),stderrClass:!stderr?'none':/Operation not permitted|Permission denied/.test(stderr)?'permission-denied':/No such file or directory|not found/.test(stderr)?'not-found':/SyntaxError/.test(stderr)?'syntax-error':/ReferenceError/.test(stderr)?'runtime-reference':'unknown'});
    function line(text){if(!text.trim())return;let row;try{row=JSON.parse(text);}catch{throw Error('ENG_TEST_PROVIDER_RESULT');}if(row.command){check(row.command.sessionId===id&&/^cmd_[a-f0-9]+$/.test(row.command.id||'')&&(!commandId||commandId===row.command.id),'ENG_TEST_PROVIDER_SCOPE');commandId=row.command.id;if(Number.isInteger(row.command.exitCode))finished=row.command.exitCode;return;}check(['stdout','stderr'].includes(row.stream)&&typeof row.data==='string','ENG_TEST_PROVIDER_RESULT');if(row.stream==='stdout')stdout+=row.data;else stderr+=row.data;check(Buffer.byteLength(stdout)+Buffer.byteLength(stderr)<=16000,'ENG_TEST_PROVIDER_RESULT');}
    try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;check(bytes<=128000,'ENG_TEST_PROVIDER_RESULT');pending+=decoder.decode(part.value,{stream:true});check(pending.length<=100000,'ENG_TEST_PROVIDER_RESULT');let n;while((n=pending.indexOf('\n'))>=0){line(pending.slice(0,n));pending=pending.slice(n+1);}}pending+=decoder.decode();if(pending.trim())line(pending);check(finished!==null,'ENG_TEST_PROVIDER_RESULT');check(!stderr,'ENG_TEST_PROVIDER_RESULT');return{exitCode:finished,stdout,diagnostic:facts()};}catch(error){throw diagnostics.attach(error,facts());}finally{await reader.cancel().catch(()=>{});}
   }finally{clearInterval(interval);controller.abort();}
  }
 };
}
module.exports={create};
