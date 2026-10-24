'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),{argsForTests}=require('../scripts/development-verification.cjs');
test('actual suite uses portable relative arguments without dropping or duplicating test files',()=>{
 const files=fs.readdirSync(path.join(__dirname)).filter(f=>f.endsWith('.test.js')).sort(),args=argsForTests(files);
 const selected=args.slice(4);if(selected.length===1&&selected[0]==='tests/*.test.js')assert.deepEqual(fs.globSync(selected[0],{cwd:path.join(__dirname,'..')}).map(f=>path.basename(f)).sort(),files);else assert.deepEqual(selected,files.map(f=>'tests/'+f));assert(args.join(' ').length<24000);assert(!args.some(path.isAbsolute));
 // Exercise process creation with the same filenames, without running the suite.
 const probe=spawnSync(process.execPath,['-e','process.exit(0)','--',...args.slice(4)],{windowsHide:true});assert.equal(probe.error,undefined);assert.equal(probe.status,0);
});

test('Node expands fixed test glob once, excluding Redis and unrelated JavaScript',()=>{
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'callercore-test-glob-'));
 try{fs.mkdirSync(path.join(dir,'tests'));for(const name of ['alpha','beta'])fs.writeFileSync(path.join(dir,'tests',name+'.test.js'),"require('node:test').test('glob-"+name+"',()=>{});\n");
  for(const name of ['redis.integration.cjs','helper.js'])fs.writeFileSync(path.join(dir,'tests',name),"throw Error('UNSELECTED_FILE_EXECUTED');\n");
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=4','tests/*.test.js'],{cwd:dir,env,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/# tests 2\b/);assert.match(result.stdout,/# pass 2\b/);assert(!result.stdout.includes('UNSELECTED_FILE_EXECUTED'));
 }finally{const resolved=path.resolve(dir);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert(path.basename(resolved).startsWith('callercore-test-glob-'));fs.rmSync(resolved,{recursive:true,force:true});}
});
test('duplicate, unsafe or oversized argument sets fail closed before process creation',()=>{
 for(const files of [[],['a.test.js','a.test.js'],['../a.test.js'],['--unsafe.test.js'],['a b.test.js'],Array.from({length:1000},(_,i)=>'oversized-file-'+i+'.test.js')])assert.throws(()=>argsForTests(files));
});
