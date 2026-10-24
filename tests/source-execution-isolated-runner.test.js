'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const runner=require('../scripts/source-execution-isolated-runner.cjs');
function evaluate(arch,nr,flags=0){const b=runner.seccompBytes();let a=0;for(let pc=0;pc<b.length/8;pc++){const c=b.readUInt16LE(pc*8),jt=b[pc*8+2],jf=b[pc*8+3],k=b.readUInt32LE(pc*8+4);if(c===0x20)a=k===4?arch:k===16?flags:nr;else if(c===0x15)pc+=a===k?jt:jf;else if(c===0x35)pc+=a>=k?jt:jf;else if(c===0x45)pc+=(a&k)!==0?jt:jf;else if(c===6)return k;else throw Error('Unexpected BPF');}throw Error('Missing return');}
test('fixed seccomp blocks alternate networking namespaces and x32 without blocking ordinary file IO',()=>{
 for(const nr of runner.DENY_SYSCALLS)assert.equal(evaluate(0xc000003e,nr),0x50001,nr);
 for(const nr of [0,1,3,9,12,56,59,60,202,231,257,444,445,446])assert.equal(evaluate(0xc000003e,nr),0x7fff0000,nr);
 assert.equal(evaluate(0x40000003,1),0x80000000);assert.equal(evaluate(0xc000003e,0x40000029),0x50001);assert.equal(evaluate(0xc000003e,0xffffffff),0x50001);
 for(const nr of [41,53,425,426,427])assert(runner.DENY_SYSCALLS.includes(nr));
 for(const flag of [0x20000,0x2000000,0x4000000,0x8000000,0x10000000,0x20000000,0x40000000])assert.equal(evaluate(0xc000003e,56,flag),0x50001);
 assert.equal(evaluate(0xc000003e,56,0x3d0f00),0x7fff0000);assert.equal(evaluate(0xc000003e,435),0x50026);
});
test('only fixed qualification and exact source-bound Starter program can be prepared',()=>{
 for(const x of [null,{},[],{mode:'shell'},{mode:'qualification',command:'id'},{mode:'starter',baseline:'x',patched:'y'}])assert.throws(()=>runner.command(x));
 const q=runner.command({mode:'qualification'});assert.equal(q.command,'/usr/bin/env');assert.deepEqual(q.args.slice(0,-1),['-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/var/empty','/usr/bin/unshare','--mount','--pid','--net','--ipc','--fork','--kill-child=SIGKILL','--mount-proc','/usr/local/bin/node','-e']);assert.equal(q.sudo,true);assert.equal(q.timeout,150000);assert.equal(q.publicationAuthorized,false);assert.equal(q.programSha256,crypto.createHash('sha256').update(q.args.at(-1)).digest('hex'));
 const baseline=fs.readFileSync(require.resolve('../dashboard.js'),'utf8'),patched=baseline.replace("    ['automations',d=>{automationsData=d.automations||[]}],","    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),");
 const p=runner.command({mode:'starter',baseline,patched});assert.equal(p.sourceHashes.patched,'c812f5c62121e503ecd0946f7ca6d09eeac1a1147b4110d7dbc5c50493146cef');assert(p.testProgramSha256);assert.equal(p.executionClass,'exact-starter-patch-only');
});
test('prepared program includes hard boundaries and bounded diagnostics, never a provider connection',()=>{
 const q=runner.command({mode:'qualification'}),s=q.args.at(-1);for(const bit of ['--make-rprivate','hidepid=2','size=134217728,nr_inodes=8192,nosuid,nodev,noexec','/usr/bin/chroot','remount,bind,ro,nosuid,nodev','--seccomp-filter=/trusted/filter.bpf','--nproc=64:64','--nofile=256:256','--cpu=30:30','--no-new-privs','--clear-groups','--no-addons','SOURCE_ISOLATION_QUALIFICATION_FAILED','stdoutSha256','stderrSha256','readOnlyRoot','readOnlyProc','outsideSentinelAbsent'])assert(s.includes(bit),bit);
 assert(!s.includes('--landlock-access'));
 assert(!s.includes('Sandbox.create'));assert(!s.includes('OPENAI_API_KEY'));assert(!s.includes('VERCEL_OIDC_TOKEN'));assert(!s.includes('shell: true'));
});
// Execute only our trusted supervisor against fake OS/process interfaces. The
// guest programs (including model-source strings) are never evaluated locally.
async function supervisorFixture(options={}){
 const baseline=fs.readFileSync(require.resolve('../dashboard.js'),'utf8'),patched=baseline.replace("    ['automations',d=>{automationsData=d.automations||[]}],","    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),");
 const q=runner.command(options.starter?{mode:'starter',baseline,patched}:{mode:'qualification'}),code=q.args.at(-1);let output='',pid=100;const children=new Map();
 const fakeProcess={execArgv:['-e',code],exitCode:0,stdout:{write:s=>output+=s},kill:group=>{const c=children.get(-group);if(c)queueMicrotask(()=>c.emit('close',null,'SIGKILL'));}};
 const files=new Map(),osCalls=[];const fakeFs={constants:{COPYFILE_EXCL:1},mkdtempSync:()=>'/var/tmp/fake-qualified',realpathSync:p=>p,statSync:()=>({isFile:()=>true,uid:options.untrustedBinary?65534:0,mode:0o555}),copyFileSync:(src,dest)=>files.set(dest,'FIXED_BINARY'),chmodSync:()=>{},mkdirSync:()=>{},chownSync:()=>{},writeFileSync:(p,s)=>files.set(p,s),readFileSync:p=>{if(p.endsWith('/timeout-child-started')&&!options.childNotStarted)return '123';if(!files.has(p))throw Object.assign(Error('Missing fixture file'),{code:'ENOENT'});return files.get(p);},readdirSync:()=>[],rmSync:()=>{if(options.cleanupFailure)throw Error('SECRET_CANARY_CLEANUP');}};
 const checkNames=['uidGid','noNewPrivileges','capabilitiesZero','groupsEmpty','protectedRead','workWrite','protectedWrite','outsideWrite','symlinkEscape','traversalEscape','outsideTmp','otherWorkspaceRead','otherExecutable','networkSockets','stdioSocketsOnly','scratchQuota','diskDenial','descriptorDenial','processThreadDenial','processGroupEscapeDenied','readOnlyRoot','readOnlyProc','outsideSentinelAbsent'];
 const ids=['baseline-starter-reproduces-automations-warning','patched-starter-omits-forbidden-feed-and-warning','entitled-plan-keeps-original-feed-handler','unrelated-feeds-and-failure-notice-preserved','appointment-capability-and-entitlement-both-required','cleared-generation-cannot-apply-stale-data-or-notice','older-generation-cannot-overwrite-newer-refresh'];
 const fakeChild={execFileSync:(exe,args)=>{osCalls.push({exe,args});if(exe==='/usr/bin/ldd')return Buffer.from(options.badLdd?'libmissing => not found':'libc.so.6 => /lib/libc.so.6 (0x00000001)\n/lib64/ld-linux-x86-64.so.2 (0x00000002)\n');if(exe==='/usr/bin/umount'&&options.unmountFailure)throw Error('SECRET_CANARY_UNMOUNT');return Buffer.alloc(0);},spawn:(_exe,args)=>{osCalls.push({exe:_exe,args});const c=new EventEmitter();c.pid=++pid;c.stdout=new EventEmitter();c.stderr=new EventEmitter();children.set(c.pid,c);const label=args.at(-1).split('/').at(-1).replace('.cjs','');if(label!=='timeout')queueMicrotask(()=>{if(options.spawnFailure){c.emit('error',Error('SECRET_CANARY_SPAWN'));c.emit('close',null,null);return;}if(label==='qualification')c.stdout.emit('data',Buffer.from(JSON.stringify({version:'source-isolation-probe-v1',checks:Object.fromEntries(checkNames.map(k=>[options.wrongChecks?'unknown_'+k:k,true])),passed:true})));if(label==='starter')c.stdout.emit('data',Buffer.from(JSON.stringify({version:'starter-source-behavioral-result-v1',tests:ids.map((id,i)=>({id:options.duplicateIds?ids[0]:id,passed:!options.starterFailure||i!==0})),passed:!options.starterFailure})));if(options.secretStderr)c.stderr.emit('data',Buffer.from('SECRET_CANARY_DO_NOT_LEAK'));if(options.outputOverflow){c.stdout.emit('data',Buffer.alloc(17000,120));return;}c.emit('close',label==='seeded-failure'||label==='starter'&&options.starterFailure?1:0,null);});return c;}};
 const done=vm.runInNewContext(code,{require:name=>{if(name==='node:fs')return fakeFs;if(name==='node:crypto')return crypto;if(name==='node:path')return path;if(name==='node:child_process')return fakeChild;throw Error('Unexpected trusted import');},Buffer,process:fakeProcess,setTimeout,clearTimeout,Promise},{timeout:1000});await done;
 return {report:JSON.parse(output),exitCode:fakeProcess.exitCode,output,osCalls,files};
}
test('trusted supervisor never converts a failing Starter test into successful execution',async()=>{
 const pass=await supervisorFixture({starter:true});assert.equal(pass.report.runPassed,true);assert.equal(pass.report.cleanupConfirmed,true);
 const fail=await supervisorFixture({starter:true,starterFailure:true});assert.equal(fail.exitCode,1);assert.equal(fail.report.runPassed,false);assert.equal(fail.report.code,'SOURCE_STARTER_TESTS_FAILED');assert.equal(fail.report.qualificationPassed,true);
});
test('duplicate test IDs and failed cleanup fail closed; diagnostics never echo raw stderr',async()=>{
 const duplicate=await supervisorFixture({starter:true,duplicateIds:true});assert.equal(duplicate.exitCode,1);assert.equal(duplicate.report.runPassed,false);
 const cleanup=await supervisorFixture({cleanupFailure:true,secretStderr:true});assert.equal(cleanup.exitCode,1);assert.equal(cleanup.report.cleanupConfirmed,false);assert.equal(cleanup.report.code,'SOURCE_GUEST_CLEANUP_FAILED');assert.equal(cleanup.output.includes('SECRET_CANARY'),false);
});

test('minimal jail setup precedes child mounts and protected children enter chroot with fixed arguments',async()=>{
 const r=await supervisorFixture();assert.equal(r.report.runPassed,true);const calls=r.osCalls;
 const bind=calls.findIndex(c=>c.exe==='/usr/bin/mount'&&c.args[0]==='--bind'&&c.args[1].endsWith('/jail'));
 const scratch=calls.findIndex(c=>c.exe==='/usr/bin/mount'&&c.args.includes('tmpfs'));assert(bind>=0&&scratch>bind);
 const run=calls.find(c=>c.exe==='/usr/bin/prlimit');assert(run.args.includes('/usr/bin/chroot'));assert(run.args.includes('/var/tmp/fake-qualified/jail'));assert(run.args.includes('--seccomp-filter=/trusted/filter.bpf'));assert.equal(run.args.at(-1),'/trusted/qualification.cjs');
 const unmounts=calls.filter(c=>c.exe==='/usr/bin/umount').map(c=>c.args[0]);assert.equal(unmounts.at(-1),'/var/tmp/fake-qualified/jail');assert.equal(new Set(unmounts).size,unmounts.length);
});

test('untrusted binary missing dependencies and wrong qualification checks cannot admit any test execution',async()=>{
 for(const option of ['untrustedBinary','badLdd','wrongChecks']){const r=await supervisorFixture({[option]:true});assert.equal(r.exitCode,1,option);assert.equal(r.report.runPassed,false,option);assert.equal(r.report.cleanupConfirmed,true,option);assert(!r.report.results.some(v=>v.label==='starter'),option);}
});

test('spawn error output overflow and unmount failure retain fail-closed classification without raw diagnostics',async()=>{
 for(const option of ['spawnFailure','outputOverflow','unmountFailure']){const r=await supervisorFixture({[option]:true,secretStderr:true});assert.equal(r.exitCode,1,option);assert.equal(r.report.runPassed,false,option);assert.equal(r.output.includes('SECRET_CANARY'),false,option);if(option==='unmountFailure')assert.equal(r.report.cleanupConfirmed,false);}
});

test('timeout cleanup cannot pass without evidence the actual grandchild started',async()=>{
 const r=await supervisorFixture({childNotStarted:true});assert.equal(r.exitCode,1);assert.equal(r.report.runPassed,false);assert.equal(r.report.code,'SOURCE_TEST_TIMEOUT_FAILED');assert.equal(r.report.results.find(x=>x.label==='timeout').childStarted,false);assert.equal(r.report.cleanupConfirmed,true);
});
