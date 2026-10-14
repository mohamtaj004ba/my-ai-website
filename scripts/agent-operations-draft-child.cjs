'use strict';
// Trusted data-only operation. Never execute draft source or caller-supplied commands.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const MARKER='\n<!-- CallerCore isolated deterministic draft; not approved for publication. -->\n';
let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',s=>{input+=s;if(input.length>200000){process.exitCode=1;process.stdin.destroy();}});
process.stdin.on('end',async()=>{try{
 const m=JSON.parse(input),root=fs.realpathSync(process.cwd());
 if(m.version!=='draft-data-v1'||!Array.isArray(m.files)||m.files.length!==1||m.files[0].path!=='dashboard.html'||!Number.isInteger(m.delayMs)||m.delayMs<0||m.delayMs>10000)throw Error('DRAFT_INPUT_DENIED');
 const f=m.files[0],target=path.join(root,f.path);
 if(fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target)!==target||!fs.statSync(target).isFile())throw Error('DRAFT_PATH_DENIED');
 const before=fs.readFileSync(target);if(before.length>200000||hash(before)!==f.sha256)throw Error('DRAFT_PREIMAGE');
 if(m.delayMs)await new Promise(r=>setTimeout(r,m.delayMs));
 const after=Buffer.concat([before,Buffer.from(MARKER)]);if(after.length>200000)throw Error('DRAFT_BOUNDS');
 fs.writeFileSync(target,after,{flag:'w'});
 const patch={path:f.path,operation:'append-fixed-html-comment',beforeSha256:hash(before),afterSha256:hash(after),addedText:MARKER};
 process.stdout.write(JSON.stringify({version:'draft-data-v1',files:[{path:f.path,beforeSha256:hash(before),afterSha256:hash(after),beforeBytes:before.length,afterBytes:after.length}],patch,patchSha256:hash(JSON.stringify(patch)),publicationAllowed:false}));
 }catch{process.stderr.write('DRAFT_CHILD_DENIED');process.exitCode=1;}});
