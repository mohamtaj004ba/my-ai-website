'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const tools=require('../lib/agent-operations-engineering-tools'),skip=require('../scripts/vercel-ignore-docs.cjs');
test('actual adapter retrieves locked deployed source and literal evidence without a provider or filesystem writer',()=>{
 const r=tools.inspect(tools.PROFILE);assert.equal(r.manifestHash,tools.hash(r.manifest));assert.equal(r.observations.length,3);
 for(const o of r.observations){const text=tools.readFile(o.evidence.path),line=text.split('\n')[o.evidence.line-1];assert.equal(o.evidence.text,line);assert.equal(o.evidence.excerptHash,tools.hash(line));assert.equal(o.evidence.sha256,tools.hash(text));assert.match(o.uncertainty,/Source-only/);}
 assert.equal(tools.capabilities().writes,false);assert.equal(tools.capabilities().paidDispatch,false);
 assert.deepEqual(tools.capabilities().levels.slice(3).map(x=>x.status),['disabled','disabled','prohibited']);
});
test('source allowlist refuses traversal, encoded paths, private state, network and shell strings before reading',()=>{
 for(const p of ['../.env','dashboard.js/../package.json','dashboard.js:secret','dashboard.js\0','dashboard\\js','%2e%2e/.env','C:/secrets','https://example.com/dashboard.js','.git/config','.vercel/project.json','sources/private.txt','api/account.js','tests/private-fixture.js','node_modules/x','dashboard.js;cat .env'])assert.throws(()=>tools.readFile(p),/DENIED/);
 assert.throws(()=>tools.inspect('https://production.example'),/PROFILE_DENIED/);
});
test('binary invalid UTF8 excessive source and recognizable secrets fail before evidence output',()=>{
 for(const text of ['sk-proj-'+'x'.repeat(40),'Bearer '+'y'.repeat(40),'https://user:password@example.test/x','api_key="'+'z'.repeat(30)+'"','-----BEGIN PRIVATE KEY'])assert.throws(()=>tools.safeText(Buffer.from(text)),/SECRET/);
 assert.throws(()=>tools.safeText(Buffer.from([0xff,0xfe])),/ENCODING/);assert.throws(()=>tools.safeText(Buffer.from([0])),/BOUNDS/);assert.throws(()=>tools.safeText(Buffer.alloc(700001,65)),/BOUNDS/);
});
test('source lock drift is rejected, never silently refreshed by a runtime read',()=>{
 const lock=require('../lib/agent-operations-engineering-source-lock.json'),old=lock.files[0].sha256;try{lock.files[0].sha256='f'.repeat(64);assert.throws(()=>tools.inspect(tools.PROFILE),/SOURCE_DRIFT/);}finally{lock.files[0].sha256=old;}
});
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/callercore-dashboards',VERCEL_GIT_PREVIOUS_SHA:'a'.repeat(40),VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)};
const fake=(paths,modes='100644')=>args=>args[0]==='rev-parse'?env.VERCEL_GIT_COMMIT_SHA:args[0]==='diff'?paths.join('\0')+'\0':args[0]==='ls-tree'?modes+' blob '+'c'.repeat(40)+'\t'+args.at(-1):'';
test('Preview documentation build skip never grants checks or changes Production/unknown build behavior',()=>{
 assert.equal(skip.decide(env,fake(['CALLERCORE_PROJECT_STATE.md'])).skip,true);
 for(const p of ['api/agent-operations.js','package.json','vercel.json','docs/executable.js','dashboard.js','lib/agent-operations-engineering-source-lock.json','.github/workflows/callercore-ci.yml'])assert.equal(skip.decide(env,fake([p])).skip,false);
 for(const patch of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_GIT_PREVIOUS_SHA:undefined},{VERCEL_GIT_COMMIT_SHA:'bad'}])assert.equal(skip.decide({...env,...patch},fake(['CALLERCORE_PROJECT_STATE.md'])).skip,false);
 assert.equal(skip.decide(env,()=>{throw Error('shallow clone missing comparison');}).skip,false);assert.equal(skip.decide(env,fake(['CALLERCORE_PROJECT_STATE.md'],'120000')).skip,false);assert.equal(skip.decide(env,fake([])).skip,false);
});
test('read adapter has no provider/network/credential or arbitrary-execution dependency',()=>{
 const source=fs.readFileSync(require.resolve('../lib/agent-operations-engineering-tools'),'utf8');assert.doesNotMatch(source,/process\.env|child_process|\bfetch\(|writeFile|createWriteStream|execFile|spawn\(/);
 const declaration=source.split('\n').find(line=>line.startsWith('const files=Object.freeze('));assert(declaration);
 for(const name of ['dashboard.html','dashboard.js','dashboard.css','package.json'])assert(declaration.includes("'"+name+"':path.resolve(__dirname,'../"+name+"')"));
 assert.equal((declaration.match(/path\.resolve\(/g)||[]).length,4);assert.doesNotMatch(declaration,/require\.resolve|process|arguments|caller/);
});

function instrument(overrides={}){const file=require.resolve('../lib/agent-operations-engineering-tools'),actual=require('node:module').createRequire(file),module={exports:{}},counts=new Map(),wrapped={...fs,readFileSync:(name,...args)=>{counts.set(String(name),(counts.get(String(name))||0)+1);return fs.readFileSync(name,...args);},...overrides},loader=name=>name==='node:fs'?wrapped:actual(name);loader.resolve=actual.resolve;require('node:vm').runInNewContext('(function(require,module,exports,__dirname){'+fs.readFileSync(file,'utf8')+'\n})',{TextDecoder,Buffer})(loader,module,module.exports,require('node:path').dirname(file));return{tools:module.exports,counts};}
test('actual adapter single snapshot never labels later re-read bytes with earlier source hashes',()=>{const r=instrument();r.tools.inspect(r.tools.PROFILE);assert.equal(r.counts.size,4);assert([...r.counts.values()].every(n=>n===1));});
test('injected symlink and realpath escape deny public source before any byte retrieval',()=>{for(const mode of ['symlink','escape']){let realCalls=0;const r=instrument(mode==='symlink'?{lstatSync:()=>({isSymbolicLink:()=>true})}:{realpathSync:name=>++realCalls%2===0?require('node:path').join(require('node:path').parse(String(name)).root,'outside','dashboard.js'):fs.realpathSync(name)});assert.throws(()=>r.tools.readFile('dashboard.js'),/DENIED|ENOENT/);assert.equal(r.counts.size,0);}});
