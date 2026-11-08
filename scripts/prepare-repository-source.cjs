'use strict';
// Build-time capture of exact tracked Git blobs. Never executes captured code.
// Only public static assets go to outputDirectory; the sanitized source pack is
// a server-only includeFile outside that directory, never a public URL.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),cp=require('node:child_process');
const reader=require('../lib/agent-operations-repository-source'),ROOT=path.resolve(__dirname,'..');
const PUBLIC_EXT=new Set(['.html','.css','.js','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.mp4','.webm','.pdf','.txt','.xml','.webmanifest']);
function publicPath(p,linked=false){
 if(reader.privatePath(p))return false;const parts=p.toLowerCase().split('/'),ext=path.posix.extname(p.toLowerCase());
 if(parts.some(x=>x.startsWith('.'))||!PUBLIC_EXT.has(ext))return false;
 if(parts.length>1)return ['assets','industries','public'].includes(parts[0]);
 return ext==='.html'||linked||['robots.txt','sitemap.xml'].includes(p.toLowerCase());
}
function publicEntries(all,raws){
 const entries=all.filter(e=>e.type==='blob'&&['100644','100755'].includes(e.mode)),byPath=new Map(entries.map(e=>[e.path,e])),chosen=new Set(entries.filter(e=>publicPath(e.path)).map(e=>e.path)),queue=[...chosen];
 for(let i=0;i<queue.length;i++){
  const p=queue[i],e=byPath.get(p),ext=path.posix.extname(p.toLowerCase());
  if(!['.html','.js','.css','.txt','.xml','.svg','.webmanifest'].includes(ext))continue;
  const text=reader.safeText(raws.get(e.blob));
  // Source links, not arbitrary root scripts, declare browser assets. New
  // ordinary frontend dependencies are discovered from HTML/JS/CSS links.
  for(const m of text.matchAll(/["'(]([^\s"'()<>]+\.(?:js|css|svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|mp4|webm|pdf|xml|webmanifest))(?:[?#][^"'()<>]*)?["')]/gi)){
   const ref=m[1];if(/^(?:[a-z]+:|\/\/)/i.test(ref))continue;
   const candidate=ref.startsWith('/')?ref.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(p),ref));
   if(byPath.has(candidate)&&publicPath(candidate,true)&&!chosen.has(candidate)){chosen.add(candidate);queue.push(candidate);}
  }
 }
 return entries.filter(e=>chosen.has(e.path));
}
function diagnosticPath(p){try{if(typeof p!=='string'||!/^[-A-Za-z0-9_. /]{1,500}$/.test(p))return'excluded-tracked-path';reader.safeText(Buffer.from(p));return reader.allowed(p)||['.gitignore','package-lock.json','vercel.json'].includes(p)?p:'excluded-tracked-path';}catch{return'excluded-tracked-path';}}
function jsonTokens(text){JSON.parse(text);let result='',quoted=false,escaped=false;for(const c of text){if(quoted){result+=c;if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"'){quoted=true;result+=c;}else if(!/[\x20\t\r\n]/.test(c))result+=c;}return result;}
function providerConfigFormattingOnly(root,paths){
 if(paths.length!==1||paths[0]!=='vercel.json')return false;
 try{const file=path.join(root,'vercel.json'),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())return false;const raw=cp.execFileSync('git',['diff','--raw','--no-abbrev','HEAD','--','vercel.json'],{cwd:root,windowsHide:true,encoding:'utf8'}).trim();if(!/^:100644 100644 [a-f0-9]{40} [a-f0-9]{40} M\tvercel\.json$/.test(raw))return false;const before=cp.execFileSync('git',['show','HEAD:vercel.json'],{cwd:root,windowsHide:true}),after=fs.readFileSync(file);return jsonTokens(reader.safeText(before))===jsonTokens(reader.safeText(after));}catch{return false;}
}
function prepare({root=ROOT,commit,packPath=reader.PACK,output=path.join(root,'public-dist'),onPhase=()=>{}}={}){
 onPhase('git-identity');
 const actual=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();commit??=actual;
 if(commit!==actual||!/^[a-f0-9]{40}$/.test(commit))throw Error('ENG_REPOSITORY_BUILD_IDENTITY');
 let providerConfigFormattingVerified=false;onPhase('tracked-source-clean');
 try{cp.execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});}catch{const error=Error('ENG_REPOSITORY_BUILD_DIRTY');let formatting=false;try{const paths=cp.execFileSync('git',['diff','--name-only','-z','HEAD','--'],{cwd:root,windowsHide:true,encoding:'utf8'}).split('\0').filter(Boolean);error.dirtyPathCount=paths.length;error.dirtyPaths=paths.slice(0,20).map(diagnosticPath);error.gitignoreChanged=paths.includes('.gitignore');error.lockfileChanged=paths.includes('package-lock.json');error.otherTrackedChanged=paths.some(p=>p!=='.gitignore'&&p!=='package-lock.json');formatting=providerConfigFormattingOnly(root,paths);}catch{}if(!formatting)throw error;providerConfigFormattingVerified=true;onPhase('provider-config-format-verified');}
 onPhase('immutable-source-snapshot');const snapshot=reader.fromGit(commit,{root});
 onPhase('public-asset-graph');const all=reader.tree(commit,{root}).filter(e=>e.type==='blob'&&['100644','100755'].includes(e.mode)&&!reader.privatePath(e.path)&&PUBLIC_EXT.has(path.posix.extname(e.path.toLowerCase()))),bytes=reader.blobs(all,{root}),entries=publicEntries(all,bytes);
 onPhase('public-output');
 const absolute=path.resolve(output),expected=path.join(path.resolve(root),'public-dist');
 if(absolute!==expected||!absolute.startsWith(path.resolve(root)+path.sep))throw Error('ENG_REPOSITORY_BUILD_TARGET');
 if(fs.existsSync(absolute)){
  if(fs.lstatSync(absolute).isSymbolicLink()||!fs.lstatSync(absolute).isDirectory()||fs.realpathSync(absolute)!==absolute||fs.readFileSync(path.join(absolute,'.callercore-generated'),'utf8')!=='public-build-output-v1')throw Error('ENG_REPOSITORY_BUILD_TARGET');
  // Verified absolute, project-owned disposable build output only.
  fs.rmSync(absolute,{recursive:true});
 }
 fs.mkdirSync(absolute,{recursive:true});fs.writeFileSync(path.join(absolute,'.callercore-generated'),'public-build-output-v1',{flag:'wx'});
 for(const e of entries){const target=path.join(absolute,e.path);if(!target.startsWith(absolute+path.sep))throw Error('ENG_REPOSITORY_BUILD_TARGET');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes.get(e.blob),{flag:'wx'});}
 onPhase('private-source-pack');fs.mkdirSync(path.dirname(packPath),{recursive:true});const packed=zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)));fs.writeFileSync(packPath,packed,{mode:0o600});
 return {version:reader.VERSION,providerConfigFormattingVerified,sourceCommit:commit,snapshotHash:snapshot.hash,sourceFiles:snapshot.files.length,contentDenied:snapshot.contentDenied,privatePackBytes:packed.length,publicFiles:entries.length,modelRequests:0,executionAuthorized:false};
}
if(require.main===module)try{console.log(JSON.stringify(prepare({commit:process.env.VERCEL_GIT_COMMIT_SHA})));}catch{console.error('ENG_REPOSITORY_BUILD_UNCONFIRMED');process.exitCode=1;}
module.exports={prepare,publicPath,publicEntries,diagnosticPath,jsonTokens,providerConfigFormattingOnly};
