'use strict';
// Trusted data-only operation. Never execute draft source or caller-supplied commands.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const MARKER='\n<!-- CallerCore isolated deterministic draft; not approved for publication. -->\n';
let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',s=>{input+=s;if(input.length>200000){process.exitCode=1;process.stdin.destroy();}});
process.stdin.on('end',async()=>{let bundleInput=false;try{
 const m=JSON.parse(input),root=fs.realpathSync(process.cwd());
 if(m.version==='draft-data-bundle-v1'){
  bundleInput=true;
  const proposed=require('../lib/agent-operations-draft-proposal'),names=['dashboard.js','lib/conversation-history.js'];
  if(Object.keys(m).sort().join(',')!=='binding,files,proposal,version'||!Array.isArray(m.files)||m.files.length!==2)throw Error('DRAFT_INPUT_DENIED');
  const files=m.files.map((f,i)=>{
   if(f.path!==names[i]||Object.keys(f).sort().join(',')!=='path,sha256,sites')throw Error('DRAFT_INPUT_DENIED');
   const target=path.join(root,f.path);if(fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target)!==target||!fs.statSync(target).isFile())throw Error('DRAFT_PATH_DENIED');
   const bytes=fs.readFileSync(target);if(bytes.length>700000||hash(bytes)!==f.sha256)throw Error('DRAFT_PREIMAGE');
   return{...f,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
  });
  const result=proposed.applyBundle(m.proposal,{binding:m.binding,files});
  // Parse complete modified files but NEVER run them. vm is not used as an
  // execution sandbox; compiling text establishes syntax only, not safety.
  try{for(const file of result.files)new(require('node:vm').Script)(file.text);}catch{throw Error('DRAFT_BUNDLE_SYNTAX');}
  for(const file of result.files)fs.writeFileSync(path.join(root,file.path),file.text,{flag:'w'});
  const summary=result.files.map(({path:filename,text,beforeSha256,afterSha256})=>({path:filename,beforeSha256,afterSha256,afterBytes:Buffer.byteLength(text)}));
  process.stdout.write(JSON.stringify({version:m.version,proposalHash:result.proposalHash,files:summary,publicationAllowed:false,sourceExecuted:false,syntaxValidated:true}));return;
 }
 const correction=m.version==='draft-data-v2'?require('../lib/agent-operations-draft-correction'):null;
 const proposed=m.version==='draft-data-v3'?require('../lib/agent-operations-draft-proposal'):null;
 if(!['draft-data-v1','draft-data-v2','draft-data-v3'].includes(m.version)||(m.version==='draft-data-v2'&&m.profile!==correction.PROFILE)||!Array.isArray(m.files)||m.files.length!==1||m.files[0].path!==(correction||proposed?'dashboard.js':'dashboard.html')||!Number.isInteger(m.delayMs)||m.delayMs<0||m.delayMs>10000)throw Error('DRAFT_INPUT_DENIED');
 const f=m.files[0],target=path.join(root,f.path);
 if(fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target)!==target||!fs.statSync(target).isFile())throw Error('DRAFT_PATH_DENIED');
 const before=fs.readFileSync(target);if(before.length>(correction||proposed?700000:200000)||hash(before)!==f.sha256)throw Error('DRAFT_PREIMAGE');
 if(m.delayMs)await new Promise(r=>setTimeout(r,m.delayMs));
 const corrected=m.version==='draft-data-v2';
 const after=proposed?Buffer.from(proposed.apply(before.toString('utf8'),m.proposal)):corrected?Buffer.from(correction.apply(before.toString('utf8'))):Buffer.concat([before,Buffer.from(MARKER)]);if(after.length>(corrected||proposed?700000:200000))throw Error('DRAFT_BOUNDS');
 fs.writeFileSync(target,after,{flag:'w'});
 const patch=proposed?proposed.patch(before.toString('utf8'),m.proposal):corrected?correction.patch(before.toString('utf8')):{path:f.path,operation:'append-fixed-html-comment',beforeSha256:hash(before),afterSha256:hash(after),addedText:MARKER};
 process.stdout.write(JSON.stringify({version:proposed?'draft-data-v3':corrected?'draft-data-v2':'draft-data-v1',files:[{path:f.path,beforeSha256:hash(before),afterSha256:hash(after),beforeBytes:before.length,afterBytes:after.length}],patch,patchSha256:hash(JSON.stringify(patch)),publicationAllowed:false}));
 }catch(error){process.stderr.write(bundleInput&&error?.message==='DRAFT_BUNDLE_SYNTAX'?'DRAFT_BUNDLE_SYNTAX':'DRAFT_CHILD_DENIED');process.exitCode=1;}});
