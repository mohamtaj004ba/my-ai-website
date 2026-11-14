'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {inspect,inventory}=require('../scripts/source-execution-inventory.cjs');
const fixture=()=>({status:'Uid:\t1001\t1001\t1001\t1001\nCapEff:\t0000000000000000\nNoNewPrivs:\t1\nSeccomp:\t2\n',limits:'Max cpu time              10                   10                   seconds\nMax processes             64                   64                   processes\nMax file size             unlimited            unlimited            bytes\nMax address space         1000000              1000000              bytes\n',controllers:'cpuset cpu io memory pids'});
test('trusted inventory reports bounded observations without qualifying execution',()=>{
 const r=inspect(fixture());assert.deepEqual(r.identity,{allUidValuesNonRoot:true,effectiveCapabilitiesZero:true,noNewPrivileges:true,seccompMode:2});assert.equal(r.processLimits.cpu,'finite-observed-not-tree-qualified');assert.equal(r.processLimits.fileSize,'unlimited');assert.deepEqual(r.availableCgroupControllers,['cpu','memory','pids','io','cpuset']);assert.equal(r.qualified,false);assert.equal(r.generatedCodeExecutionAllowed,false);assert.equal(r.unresolved.length,8);
});
test('missing malformed duplicate and oversized evidence stays unknown',()=>{
 for(const status of [null,{},'Uid: 1001 1001 1001 1001\nUid: 0 0 0 0','Uid: -1 1 1 1','Uid: '+'9'.repeat(65537)])assert.equal(inspect({status}).identity.allUidValuesNonRoot,null);
 assert.equal(inspect({limits:'Max cpu time 1 1 seconds\nMax cpu time 2 2 seconds'}).processLimits.cpu,'unavailable');
 for(const controllers of ['cpu unknown','cpu cpu',null])assert.equal(inspect({controllers}).availableCgroupControllers,null);
});
test('root capabilities and privilege conditions are not silently accepted',()=>{
 const f=fixture();f.status='Uid: 1001 0 1001 1001\nCapEff: 0000000000000001\nNoNewPrivs: 0\nSeccomp: 0';const r=inspect(f);assert.equal(r.identity.allUidValuesNonRoot,false);assert.equal(r.identity.effectiveCapabilitiesZero,false);assert.equal(r.identity.noNewPrivileges,false);assert.equal(r.identity.seccompMode,0);assert.equal(r.qualified,false);
});
test('impossible UID and contradictory kernel limits remain unknown',()=>{
 assert.equal(inspect({status:'Uid: 99999999999999999999999 1 1 1'}).identity.allUidValuesNonRoot,null);
 for(const values of ['100 1 seconds','unlimited 1 seconds'])assert.equal(inspect({limits:'Max cpu time '+values}).processLimits.cpu,'unavailable');
 assert.deepEqual(inspect({controllers:'\n'}).availableCgroupControllers,[]);
});
test('untrusted evidence and unrelated fields cannot enter diagnostic output',()=>{
 const secret='CANARY_CONFIDENTIAL_DO_NOT_ECHO',f=fixture();f.status+='Secret: '+secret+'\n';f.environment=secret;f.controllers='cpu '+secret;f.limits=secret;const output=JSON.stringify(inspect(f));assert.equal(output.includes(secret),false);assert.equal(inspect({...f,qualified:true,generatedCodeExecutionAllowed:true}).generatedCodeExecutionAllowed,false);
});
test('inventory has no provisioning execution network or mutation APIs',()=>{
 const source=fs.readFileSync(require.resolve('../scripts/source-execution-inventory.cjs'),'utf8');for(const forbidden of ['child_process','execSync','spawn(', 'writeFile','fetch(', 'Sandbox.create','process.env','sudo'])assert.equal(source.includes(forbidden),false,forbidden);
 if(process.platform!=='linux')assert.equal(inventory().code,'QUAL_PLATFORM_UNSUPPORTED');
});
