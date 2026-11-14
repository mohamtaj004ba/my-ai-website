'use strict';
// Shared immutable SOURCE visibility. No grants, model calls, shell, network,
// source execution, repository writes or publication. The caller supplies authority.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const VERSION='repository-source-v1',REPOSITORY='mohamtaj004ba/my-ai-website';
const ROOT=path.resolve(__dirname,'..'),PACK=path.join(ROOT,'node_modules/.cache/callercore/repository-source.json.gz');
const POLICY='tracked-source-read-v1';
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const check=(ok,code='ENG_REPOSITORY_DENIED')=>{if(!ok)throw Error(code);};
const SOURCE_EXT=new Set(['.js','.cjs','.mjs','.jsx','.ts','.tsx','.mts','.cts','.html','.css','.scss','.sass','.less','.vue','.svelte','.json','.md','.txt','.yaml','.yml','.sql','.py','.sh','.ps1','.toml','.xml','.graphql','.gql','.prisma','.proto','.go','.rs','.java','.rb','.php','.cs','.c','.cpp','.h']);
function canonical(p){check(typeof p==='string'&&p.length>0&&p.length<=500&&!/[\\\x00-\x1f:]/.test(p)&&!p.startsWith('/')&&p.split('/').every(x=>x&&!['.','..'].includes(x)&&!x.startsWith('-')));return p;}
function privatePath(p){
 try{canonical(p);}catch{return true;}
 const parts=p.toLowerCase().split('/'),base=parts.at(-1);
 return parts.some(x=>['.git','.vercel','node_modules','artifacts','qa-artifacts','coverage','dist','build','public-dist','backups','exports','private','customer-data','logs'].includes(x)||x.startsWith('.env'))||/\.(?:pem|key|p12|pfx|sqlite|db)(?:\.|$)/i.test(base)||/(?:^|[-_.])(?:credentials|secrets|transcripts?|private[-_]exports?|customer[-_]data)(?:[-_.]|$)/.test(base);
}
function allowed(p){
 if(privatePath(p))return false;
 const lower=p.toLowerCase(),base=path.posix.basename(lower),ext=path.posix.extname(lower);
 if(!SOURCE_EXT.has(ext))return false;
 if(ext==='.json'&&!(lower==='package.json'||/^\w*(?:tsconfig|jsconfig)[\w.-]*\.json$/.test(base)||/\.(?:config|schema)\.json$/.test(base)||lower.startsWith('config/')||lower.startsWith('schemas/')||lower.startsWith('lib/')||lower.startsWith('docs/engineering-changes/')))return false;
 if(ext==='.json'&&/(?:^|[-_.])(?:customers?|contacts?|invoices?|transactions?|messages|records|exports?)(?:[-_.]|$)/.test(base)&&!base.endsWith('.schema.json'))return false;
 if(lower.startsWith('tests/fixtures/')&&ext==='.json')return false;
 if(/(?:package-lock|npm-shrinkwrap|yarn\.lock|pnpm-lock|agent-operations-contract-lock|agent-operations-engineering-source-lock)/.test(base))return false;
 return true;
}
function safeText(raw){
 check(Buffer.isBuffer(raw)&&!raw.includes(0),'ENG_REPOSITORY_CONTENT_DENIED');let text;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);}catch{throw Error('ENG_REPOSITORY_CONTENT_DENIED');}
 check(!/(?:https?:\/\/[^/\s"'<>]+@|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[A-Z0-9]{16}|Bearer\s+[A-Za-z0-9_.-]{24,}|(?:api[_-]?key|password|secret|token)\s*[:=]\s*["'][A-Za-z0-9_.-]{24,}["']|"sourceGzipBase64"|"(?:access_token|refresh_token)"\s*:)/i.test(text),'ENG_REPOSITORY_CONTENT_DENIED');
 return text;
}
function git(args,{root=ROOT,input,maxBuffer=512*1024*1024}={}){return require('node:child_process').execFileSync('git',args,{cwd:root,input,windowsHide:true,maxBuffer,stdio:['pipe','pipe','pipe']});}
function tree(commit,{root=ROOT}={}){
 check(/^[a-f0-9]{40}$/.test(commit));
 return git(['ls-tree','-r','-z','--full-tree',commit],{root}).toString('utf8').split('\0').filter(Boolean).map(row=>{
  const at=row.indexOf('\t'),[mode,type,blob]=row.slice(0,at).split(' ');return{path:row.slice(at+1),mode,type,blob};
 });
}
function blobs(entries,{root=ROOT}={}){
 const ids=[...new Set(entries.map(e=>e.blob))];if(!ids.length)return new Map();
 const input=ids.join('\n')+'\n',sizes=git(['cat-file','--batch-check'],{root,input}).toString('ascii').trim().split('\n');let total=0;
 check(sizes.length===ids.length,'ENG_REPOSITORY_RESOURCE');for(const [i,row]of sizes.entries()){const [sha,type,n]=row.trim().split(' '),size=Number(n);check(sha===ids[i]&&type==='blob'&&Number.isSafeInteger(size)&&size>=0,'ENG_REPOSITORY_RESOURCE');total+=size;}
 check(Number.isSafeInteger(total)&&total<=Math.floor(require('node:v8').getHeapStatistics().heap_size_limit/16),'ENG_REPOSITORY_RESOURCE');
 const bytes=git(['cat-file','--batch'],{root,input,maxBuffer:Math.max(1048576,total+ids.length*128)}),out=new Map();let offset=0;
 for(const id of ids){const end=bytes.indexOf(10,offset);check(end>offset);const [sha,type,sizeString]=bytes.subarray(offset,end).toString('ascii').split(' '),size=Number(sizeString);check(sha===id&&type==='blob'&&Number.isSafeInteger(size)&&size>=0&&end+1+size<bytes.length);const raw=bytes.subarray(end+1,end+1+size);check(bytes[end+1+size]===10);out.set(id,raw);offset=end+2+size;}
 check(offset===bytes.length);return out;
}
function fromGit(commit,{root=ROOT}={}){
 const entries=tree(commit,{root}).filter(e=>e.type==='blob'&&['100644','100755'].includes(e.mode)&&allowed(e.path)),raws=blobs(entries,{root});
 const files=[];let contentDenied=0;
 for(const e of entries){const raw=raws.get(e.blob);try{const text=safeText(raw);files.push({...e,bytes:raw.length,sha256:hash(raw.toString('utf8')),text});}catch(error){if(error.message!=='ENG_REPOSITORY_CONTENT_DENIED')throw error;contentDenied++;}}
 files.sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
 const body={version:VERSION,repository:REPOSITORY,commit,policy:POLICY,files,contentDenied};return {...body,hash:hash(body)};
}
function validate(snapshot,commit){
 check(snapshot?.version===VERSION&&snapshot.repository===REPOSITORY&&snapshot.commit===commit&&/^[a-f0-9]{40}$/.test(commit)&&snapshot.policy===POLICY&&Array.isArray(snapshot.files),'ENG_REPOSITORY_IDENTITY');
 const {hash:stored,...body}=snapshot;check(stored===hash(body),'ENG_REPOSITORY_INTEGRITY');const seen=new Set();
 for(const f of snapshot.files){check(allowed(f.path)&&!seen.has(f.path)&&['100644','100755'].includes(f.mode)&&f.type==='blob'&&/^[a-f0-9]{40}$/.test(f.blob)&&typeof f.text==='string');seen.add(f.path);const raw=Buffer.from(f.text);check(safeText(raw)===f.text&&raw.length===f.bytes&&hash(f.text)===f.sha256);check(crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex')===f.blob,'ENG_REPOSITORY_BLOB');}
 return snapshot;
}
let cached;const verified=new WeakSet();
function frozen(snapshot){for(const f of snapshot.files)Object.freeze(f);Object.freeze(snapshot.files);Object.freeze(snapshot);verified.add(snapshot);return snapshot;}
function deployed(commit){
 if(process.env.VERCEL_ENV)check(process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_GIT_COMMIT_REF==='feature/callercore-dashboards'&&process.env.VERCEL_GIT_COMMIT_SHA===commit,'ENG_REPOSITORY_RUNTIME');
 if(cached?.commit===commit)return cached;
 if(process.env.VERCEL_ENV||fs.existsSync(PACK)){check(fs.lstatSync(PACK).isFile()&&!fs.lstatSync(PACK).isSymbolicLink());const memoryBound=Math.floor(require('node:v8').getHeapStatistics().heap_size_limit/16);check(fs.statSync(PACK).size<=memoryBound,'ENG_REPOSITORY_RESOURCE');const packed=JSON.parse(zlib.gunzipSync(fs.readFileSync(PACK),{maxOutputLength:memoryBound}).toString('utf8'));if(packed.commit===commit)cached=frozen(validate(packed,commit));else if(process.env.VERCEL_ENV)throw Error('ENG_REPOSITORY_IDENTITY');}
 if(cached?.commit!==commit)cached=frozen(validate(fromGit(commit),commit));
 return cached;
}
function cursor(snapshot,query,offset){const body={snapshot:snapshot.hash,query:hash(query),offset};return Buffer.from(JSON.stringify({...body,hash:hash(body)})).toString('base64url');}
function offset(snapshot,query,value){if(!value)return 0;try{check(typeof value==='string'&&value.length<1000);const decoded=JSON.parse(Buffer.from(value,'base64url'));const {hash:h,...body}=decoded;check(body.snapshot===snapshot.hash&&body.query===hash(query)&&h===hash(body)&&Number.isSafeInteger(body.offset)&&body.offset>=0);return body.offset;}catch{throw Error('ENG_REPOSITORY_CURSOR');}}
function requestShape(q){check(q&&Object.keys(q).sort().join(',')==='cursor,kind,lineCount,path,query,startColumn,startLine'&&['browse','search','read','read-file'].includes(q.kind)&&typeof q.path==='string'&&typeof q.query==='string'&&q.query.length<=300&&typeof q.cursor==='string'&&Number.isSafeInteger(q.startLine)&&q.startLine>=1&&Number.isSafeInteger(q.startColumn)&&q.startColumn>=0&&Number.isSafeInteger(q.lineCount)&&q.lineCount>=1&&q.lineCount<=200);if(q.path)canonical(q.path);safeText(Buffer.from(q.query));if(q.kind==='search')check(q.query.trim().length>0);return q;}
const initial=()=>({kind:'browse',path:'',query:'',startLine:1,startColumn:0,lineCount:40,cursor:''});
function inspect(snapshot,input=initial()){
 if(!verified.has(snapshot))validate(snapshot,snapshot.commit);const q=requestShape(input),base={...q,cursor:''},start=offset(snapshot,base,q.cursor),files=snapshot.files.filter(f=>!q.path||f.path===q.path||f.path.startsWith(q.path+'/'));
 const body={version:VERSION,repository:REPOSITORY,sourceCommit:snapshot.commit,snapshotHash:snapshot.hash,policy:POLICY,request:structuredClone(q),files:[],evidence:[],nextCursor:null,nextRead:null,coverage:'Tracked source only; binaries, private data, credential material, generated archives and denied fixture exports are excluded. Reads do not establish runtime reproduction or grant implementation/test/publication authority.'};
 body.areaCounts={};for(const f of snapshot.files){const area=f.path.includes('/')?f.path.split('/')[0]:'root';body.areaCounts[area]=(body.areaCounts[area]||0)+1;}
 if(q.kind==='browse'){
  body.files=files.slice(start,start+40).map(({path,sha256,blob,bytes})=>({path,sha256,blob,bytes}));if(start+40<files.length)body.nextCursor=cursor(snapshot,base,start+40);
 }else if(q.kind==='search'){
  const needle=q.query.toLocaleLowerCase('en');let found=0,more=false;
  matches:for(const f of files)for(const [i,line]of f.text.split(/\r?\n/).entries())if(line.toLocaleLowerCase('en').includes(needle)){
   if(found++<start)continue;const item=excerpt(snapshot,f,i+1,0,1);
   const previous=body.files;body.evidence.push(item);body.files=files.filter(f=>body.evidence.some(e=>e.path===f.path)).map(({path,sha256,blob,bytes})=>({path,sha256,blob,bytes}));
   if(body.evidence.length>12||Buffer.byteLength(JSON.stringify(body))>22000){body.evidence.pop();body.files=previous;more=true;break matches;}
  }
  if(more)body.nextCursor=cursor(snapshot,base,start+body.evidence.length);
 }else{
  const f=snapshot.files.find(file=>file.path===q.path);
  check(f,'ENG_REPOSITORY_DENIED');
  const wholeFile=q.kind==='read-file';
  if(wholeFile)check(!q.cursor&&!q.query,'ENG_REPOSITORY_RANGE');
  body.files=[{path:f.path,sha256:f.sha256,blob:f.blob,bytes:f.bytes}];
  let budget=wholeFile?16000:8000;
  do {
   const count=wholeFile?Number.MAX_SAFE_INTEGER-q.startLine:q.lineCount;
   const e=excerpt(snapshot,f,q.startLine,q.startColumn,count,budget,wholeFile);
   body.evidence=[e];
   body.nextRead=e.next?{...q,startLine:e.next.line,startColumn:e.next.column,cursor:''}:null;
   // The provider wraps the packet in a JSON text field, escaping it again.
   if(!wholeFile||Buffer.byteLength(JSON.stringify(JSON.stringify(body)))<=22000)break;
   budget=Math.floor(budget/2);
  } while(budget>=4);
 }
 check(Buffer.byteLength(JSON.stringify(body))<=24000,'ENG_REPOSITORY_VIEW_SIZE');return body;
}
function excerpt(snapshot,f,startLine,startColumn,count,budget=8000,preserveNewline=false){
 const lines=f.text.split(/\r?\n/);check(startLine<=lines.length&&startColumn<=lines[startLine-1].length,'ENG_REPOSITORY_RANGE');let text='',line=startLine,column=startColumn,remaining=budget;
 if(column>0)check(!(lines[line-1].charCodeAt(column)>=0xdc00&&lines[line-1].charCodeAt(column)<=0xdfff&&lines[line-1].charCodeAt(column-1)>=0xd800&&lines[line-1].charCodeAt(column-1)<=0xdbff),'ENG_REPOSITORY_RANGE');
 outer:for(;;){for(const ch of Array.from(lines[line-1].slice(column))){const bytes=Buffer.byteLength(ch);if(bytes>remaining)break outer;text+=ch;remaining-=bytes;column+=ch.length;}if(line===Math.min(lines.length,startLine+count-1)||remaining<1)break;text+='\n';remaining--;line++;column=0;}
 const endLine=line,endColumn=column,next=preserveNewline&&remaining===0&&line<lines.length&&column===lines[line-1].length?{line,column}:column>=lines[line-1].length?(line<lines.length?{line:line+1,column:0}:null):{line,column};
 const value={path:f.path,blob:f.blob,sha256:f.sha256,line:startLine,startColumn,endLine,endColumn,text,excerptHash:hash(text),viewNormalization:'lf',next};return{id:'source_'+hash({snapshot:snapshot.hash,...value}).slice(0,24),...value};
}
module.exports={VERSION,REPOSITORY,POLICY,PACK,hash,canonical,privatePath,allowed,safeText,tree,blobs,fromGit,validate,deployed,initial,requestShape,inspect};
