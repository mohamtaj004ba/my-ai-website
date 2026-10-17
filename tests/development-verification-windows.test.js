'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),{argsForTests}=require('../scripts/development-verification.cjs');
test('actual suite uses portable relative arguments without dropping or duplicating test files',()=>{
 const files=fs.readdirSync(path.join(__dirname)).filter(f=>f.endsWith('.test.js')).sort(),args=argsForTests(files);
 assert.deepEqual(args.slice(4),files.map(f=>'tests/'+f));assert(args.join(' ').length<24000);assert(!args.some(path.isAbsolute));
 // Exercise process creation with the same filenames, without running the suite.
 const probe=spawnSync(process.execPath,['-e','process.exit(0)','--',...args.slice(4)],{windowsHide:true});assert.equal(probe.error,undefined);assert.equal(probe.status,0);
});
test('duplicate, unsafe or oversized argument sets fail closed before process creation',()=>{
 for(const files of [[],['a.test.js','a.test.js'],['../a.test.js'],['--unsafe.test.js'],['a b.test.js'],Array.from({length:1000},(_,i)=>'oversized-file-'+i+'.test.js')])assert.throws(()=>argsForTests(files));
});
