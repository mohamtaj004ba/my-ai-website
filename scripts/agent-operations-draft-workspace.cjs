'use strict';
// Disposable filesystem for trusted patch-data only, NOT an untrusted-code sandbox.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const tools=require('../lib/agent-operations-engineering-tools');
const CHILD=require.resolve('./agent-operations-draft-child.cjs');
const correction=require('../lib/agent-operations-draft-correction');
const CORRECTION=require.resolve('../lib/agent-operations-draft-correction');
const SOURCE_LOCK=require('../lib/agent-operations-engineering-source-lock.json');
const MARKER='\n<!-- CallerCore isolated deterministic draft; not approved for publication. -->\n';
// Frozen expected output for the source-lock fixture, checked by actual-child regression.
const EXPECTED_AFTER='fc7f8f92700a73bcc53f3979b8fb5f969cdc03aaac294bd360015f710c35ac58';
const QUALIFICATION='Fixed comment append only. Draft source is never executed. No untrusted-code sandbox, repository writer, shell, network adapter, commit, push or deployment executor.';
const CORRECTION_QUALIFICATION='Reviewed fixed local-calendar chart correction only. Draft source is never executed. No untrusted-code sandbox, repository writer, shell, network adapter, commit, push or deployment executor.';
const LIMITS=Object.freeze({maxFiles:3,maxBytes:200000,maxDurationMs:10000,maxOutputBytes:16000,maxOldSpaceMb:64,network:false,arbitraryCommands:false,externalCodeExecution:false,publication:false});
const CORRECTION_LIMITS=Object.freeze({...LIMITS,maxBytes:700000});
const check=(v,c)=>{if(!v)throw Error(c);};
function validateArtifact(result,{sourceSha}={}){
 // Pure persisted-data validation. Caller still enforces authenticated task/release/fence binding.
 check(/^[a-f0-9]{40}$/.test(sourceSha||'')&&result&&result.sourceSha===sourceSha,'DRAFT_SOURCE_BINDING');
 const keys=['version','files','patch','patchSha256','publicationAllowed','sourceSha','sourceManifestHash','repository','branch','limits','cleanup','classification','qualification'];
 check(Object.keys(result).length===keys.length&&keys.every(k=>Object.hasOwn(result,k)),'DRAFT_RESULT_INVALID');
 const isCorrection=result.version==='draft-data-v2';
 const source=SOURCE_LOCK.files.find(f=>f.path===(isCorrection?'dashboard.js':'dashboard.html'));
 const patch={path:'dashboard.html',operation:'append-fixed-html-comment',beforeSha256:source.sha256,afterSha256:EXPECTED_AFTER,addedText:MARKER};
 const text=isCorrection?tools.readFile('dashboard.js'):null,expectedPatch=isCorrection?correction.patch(text):patch;
 const afterHash=isCorrection?expectedPatch.afterSha256:EXPECTED_AFTER;
 const file={path:isCorrection?'dashboard.js':'dashboard.html',beforeSha256:source.sha256,afterSha256:afterHash,beforeBytes:source.bytes,afterBytes:isCorrection?Buffer.byteLength(correction.apply(text)):source.bytes+Buffer.byteLength(MARKER)};
 check(['draft-data-v1','draft-data-v2'].includes(result.version)&&result.files?.length===1&&tools.hash(result.files[0])===tools.hash(file)&&tools.hash(result.patch)===tools.hash(expectedPatch)&&result.patchSha256===tools.hash(expectedPatch),'DRAFT_RESULT_INVALID');
 check(result.sourceManifestHash===tools.hash(SOURCE_LOCK)&&result.repository==='mohamtaj004ba/my-ai-website'&&result.branch==='feature/callercore-dashboards','DRAFT_SOURCE_BINDING');
 check(result.publicationAllowed===false&&tools.hash(result.limits)===tools.hash(isCorrection?CORRECTION_LIMITS:LIMITS)&&tools.hash(result.cleanup)===tools.hash({destroyed:true})&&result.classification==='real-disposable-filesystem-trusted-data-only'&&result.qualification===(isCorrection?CORRECTION_QUALIFICATION:QUALIFICATION),'DRAFT_AUTHORITY_DENIED');
 return true;
}
async function prepare(options={}){
 const {sourceSha,expectedSourceSha,signal,timeoutMs=10000,delayMs=0,profile=null}=options;
 check(/^[a-f0-9]{40}$/.test(sourceSha||'')&&sourceSha===expectedSourceSha,'DRAFT_SOURCE_BINDING');
 check(Object.keys(options).every(k=>['sourceSha','expectedSourceSha','signal','timeoutMs','delayMs','profile'].includes(k)),'DRAFT_INPUT_DENIED');
 check(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=10000&&Number.isInteger(delayMs)&&delayMs>=0&&delayMs<=10000,'DRAFT_LIMITS');
 check(profile===null||profile===correction.PROFILE,'DRAFT_INPUT_DENIED');
 check(!signal?.aborted,'DRAFT_CANCELLED');
 const filename=profile?'dashboard.js':'dashboard.html',limits=profile?CORRECTION_LIMITS:LIMITS;
 const inspected=tools.inspect(tools.PROFILE),text=tools.readFile(filename),expected=inspected.manifest.files.find(x=>x.path===filename);
 check(tools.hash(text)===expected.sha256,'DRAFT_SOURCE_DRIFT');check(Buffer.byteLength(text)+100<=limits.maxBytes,'DRAFT_BOUNDS');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),profile?'callercore-correction-':'callercore-draft-'));let result,error;
 try{
  fs.writeFileSync(path.join(directory,filename),text,{flag:'wx',mode:0o600});
  result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--max-old-space-size=64','--permission',`--allow-fs-read=${CHILD}`,`--allow-fs-read=${CORRECTION}`,`--allow-fs-read=${directory}`,`--allow-fs-write=${directory}`,CHILD],{cwd:directory,env:{},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='',bytes=0,reason=null;
   const stop=c=>{reason=reason||c;child.kill();};
   const abort=()=>stop('DRAFT_CANCELLED'),timer=setTimeout(()=>stop('DRAFT_TIMEOUT'),timeoutMs);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
   child.stdout.on('data',b=>{bytes+=b.length;if(bytes>LIMITS.maxOutputBytes)stop('DRAFT_OUTPUT_BOUNDS');else output+=b.toString('utf8');});
   child.stderr.on('data',b=>{bytes+=b.length;if(bytes>LIMITS.maxOutputBytes)stop('DRAFT_OUTPUT_BOUNDS');});
   child.on('error',()=>{reason=reason||'DRAFT_START_FAILED';});
   child.stdin.on('error',()=>{});
   child.on('close',code=>{finish();if(reason||code!==0)return reject(Error(reason||'DRAFT_CHILD_DENIED'));try{resolve(JSON.parse(output));}catch{reject(Error('DRAFT_RESULT_INVALID'));}});
   child.stdin.end(JSON.stringify({version:profile?'draft-data-v2':'draft-data-v1',profile,files:[{path:filename,sha256:expected.sha256}],delayMs}));
  });
  const after=fs.readFileSync(path.join(directory,filename));
  check(result.files?.length===1&&result.files[0].beforeSha256===expected.sha256&&result.files[0].afterSha256===tools.hash(after.toString('utf8'))&&result.patchSha256===tools.hash(result.patch)&&result.publicationAllowed===false,'DRAFT_RESULT_INVALID');
 }catch(e){error=e;}finally{
  fs.rmSync(directory,{recursive:true,force:true,maxRetries:2});
  check(!fs.existsSync(directory),'DRAFT_CLEANUP_FAILED');
  check(tools.hash(tools.readFile(filename))===expected.sha256,'DRAFT_AUTHORITATIVE_SOURCE_CHANGED');
 }
 if(error)throw error;
 const artifact={...result,sourceSha,sourceManifestHash:inspected.manifestHash,repository:inspected.repository,branch:inspected.branch,limits,cleanup:{destroyed:true},classification:'real-disposable-filesystem-trusted-data-only',qualification:profile?CORRECTION_QUALIFICATION:QUALIFICATION};
 validateArtifact(artifact,{sourceSha});return artifact;
}
module.exports={prepare,validateArtifact,LIMITS};
