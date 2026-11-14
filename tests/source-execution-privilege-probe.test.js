'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const crypto=require('node:crypto'),fs=require('node:fs');
const {probeCommand}=require('../scripts/source-execution-privilege-probe.cjs');
const good=()=>['Uid: 65534 65534 65534 65534','Gid: 65534 65534 65534 65534','Groups:','NoNewPrivs: 1','Seccomp: 2',...['CapEff','CapPrm','CapInh','CapAmb','CapBnd'].map(k=>k+': 0000000000000000')].join('\n');
// This VM evaluates only our fixed trusted probe with fake filesystem/process data.
// It is not an isolation boundary and never receives model-generated code.
function fixture(status){
 const plan=probeCommand('/usr/bin/node'),code=plan.args.at(-1);let output='';
 const fakeProcess={platform:'linux',version:'fixture-only',execArgv:['-e',code],exitCode:undefined,stdout:{write:s=>output+=s}};
 const paths=[];
 const fakeFs={openSync:p=>{paths.push(p);return p;},readSync:(p,b)=>{const value=p==='/proc/self/status'?status:p==='/proc/self/limits'?'':'cpu memory pids';return b.write(value);},closeSync:()=>{}};
 vm.runInNewContext(code,{require:name=>{if(name==='node:fs')return fakeFs;if(name==='node:crypto')return crypto;throw Error('Unexpected import');},Buffer,process:fakeProcess,module:{exports:{}},Object},{timeout:1000});
 return {report:JSON.parse(output),exitCode:fakeProcess.exitCode,paths,plan};
}
test('fixed privilege-drop argv cannot be replaced with a model command',()=>{
 const p=probeCommand('/usr/bin/node');assert.equal(p.command,'/usr/bin/setpriv');assert.deepEqual(p.args.slice(0,-1),['--no-new-privs','--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--reuid=65534','--regid=65534','--clear-groups','--reset-env','--','/usr/bin/node','-e']);assert.equal(p.sudo,true);assert.equal(p.timeout,15000);assert.equal(p.qualified,false);assert.equal(p.generatedCodeExecutionAllowed,false);
 for(const input of [null,undefined,'node','/bin/sh','/usr/bin/node; id','../node','/usr/bin/node\n'])assert.throws(()=>probeCommand(input),/QUAL_NODE_PATH_DENIED/);
 assert.throws(()=>probeCommand('/usr/bin/node','-e malicious'),/QUAL_NODE_PATH_DENIED/);
 assert.equal(probeCommand('/usr/local/bin/node').args.at(-3),'/usr/local/bin/node');
});
test('trusted fixture proves only its privilege observations and records complete source hash',()=>{
 const r=fixture(good());assert.equal(r.exitCode,0);assert.equal(r.report.privilegeProbePassed,true);assert.equal(r.report.qualified,false);assert.equal(r.report.generatedCodeExecutionAllowed,false);assert.equal(r.report.probeSourceSha256,r.plan.probeSourceSha256);assert(r.paths.every(p=>['/proc/self/status','/proc/self/limits','/sys/fs/cgroup/cgroup.controllers'].includes(p)));
});
test('every missing privilege field rejects the probe without raw output',()=>{
 for(const field of ['Uid','Gid','Groups','NoNewPrivs','CapEff','CapPrm','CapInh','CapAmb','CapBnd']){const r=fixture(good().split('\n').filter(x=>!x.startsWith(field+':')).join('\n'));assert.equal(r.exitCode,1,field);assert.equal(r.report.privilegeProbePassed,false,field);}
});
test('root supplementary groups new privileges and every capability set remain denied',()=>{
 for(const [from,to] of [['Uid: 65534 65534 65534 65534','Uid: 0 0 0 0'],['Gid: 65534 65534 65534 65534','Gid: 0 0 0 0'],['Groups:','Groups: 0'],['NoNewPrivs: 1','NoNewPrivs: 0'],...['CapEff','CapPrm','CapInh','CapAmb','CapBnd'].map(k=>[k+': 0000000000000000',k+': 0000000000000001'])])assert.equal(fixture(good().replace(from,to)).exitCode,1,to);
});
test('duplicate metadata and secret canaries cannot produce a pass or leak content',()=>{
 const secret='CONFIDENTIAL_CANARY_NEVER_LOG';const r=fixture(good()+'\nUid: 65534 65534 65534 65534\nSecret: '+secret);assert.equal(r.exitCode,1);assert.equal(JSON.stringify(r.report).includes(secret),false);
});
test('preparation module does not execute provision or install anything',()=>{
 const s=fs.readFileSync(require.resolve('../scripts/source-execution-privilege-probe.cjs'),'utf8');for(const x of ['child_process','spawn(','execFile(','Sandbox.create','process.env','fetch(','writeFile'])assert.equal(s.includes(x),false,x);
});
