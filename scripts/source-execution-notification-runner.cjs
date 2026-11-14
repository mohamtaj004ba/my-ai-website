'use strict';
// Versioned second fixed guest recipe, using the existing jail/resource/cleanup policy.
// Legacy Starter supervisor bytes must remain untouched for historical command hashes.
// Preparation only: no VM, shell invocation or local source execution.
const {createHash}=require('node:crypto'),{seccompBytes}=require('./source-execution-isolated-runner.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
function command(input){
 if(arguments.length!==1||!input||input.mode!=='notification'||Object.keys(input).sort().join(',')!=='baseline,mode,patched')throw Error('NOTIFICATION_TEST_MODE_DENIED');
 const test=require('./source-execution-notification-tests.cjs').buildProgram({baseline:input.baseline,patched:input.patched});
 const payload={mode:'notification',test:{program:test.program,programSha256:test.programSha256,sourceHashes:test.sourceHashes},seccomp:seccompBytes().toString('base64'),probe:'('+qualificationProbe.toString()+')()'};
 const code='('+notificationSupervisor.toString()+')('+JSON.stringify(payload)+');';
 return{version:'notification-isolated-runner-command-v1',command:'/usr/bin/env',args:['-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/var/empty','/usr/bin/unshare','--mount','--pid','--net','--ipc','--fork','--kill-child=SIGKILL','--mount-proc','/usr/local/bin/node','-e',code],sudo:true,timeout:150000,programSha256:hash(code),testProgramSha256:test.programSha256,sourceHashes:test.sourceHashes,executionClass:'exact-notification-patch-only',publicationAuthorized:false,executionAuthorized:false,qualified:false};
}
async function notificationSupervisor(payload){
 const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync,spawn}=require('node:child_process');
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 const root=fs.mkdtempSync('/var/tmp/callercore-test-'),jail=root+'/jail',trusted=jail+'/trusted',work=jail+'/work',other=root+'/other';
 const results=[],mounts=[];let mounted=false,phase='private-mounts',report,qualificationPassed=false;
 const fixed=(exe,args)=>execFileSync(exe,args,{timeout:5000,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin:/usr/local/bin'}});
 try{
  fixed('/usr/bin/mount',['--make-rprivate','/']);
  fixed('/usr/bin/mount',['-o','remount,hidepid=2,nosuid,nodev,noexec','/proc']);
  phase='minimal-jail';fs.chmodSync(root,0o755);for(const d of [jail,trusted,work,other,jail+'/proc',jail+'/dev',jail+'/tmp'])fs.mkdirSync(d,{mode:0o755});
  fixed('/usr/bin/mount',['--bind',jail,jail]);mounts.push(jail);mounted=true;
  const pinnedBinaries=['/usr/local/bin/node','/usr/bin/setpriv'];const copies=new Map();
  for(const binary of pinnedBinaries){
   const real=fs.realpathSync(binary),st=fs.statSync(real);if(!st.isFile()||st.uid===65534||(st.mode&0o022))throw Error('SOURCE_TRUSTED_BINARY_DENIED');
   copies.set(binary,real);const lines=fixed('/usr/bin/ldd',[binary]).toString('utf8').split('\n');
   for(const line of lines){if(!line.trim()||/^\s*linux-vdso\.so/.test(line))continue;
    const m=line.match(/(?:=>\s*)?(\/[^\s]+)\s+\(0x[0-9a-f]+\)/);if(!m||/not found/.test(line))throw Error('SOURCE_TRUSTED_LIBRARY_DENIED');
    const path=m[1],realLib=fs.realpathSync(path),stLib=fs.statSync(realLib);if(!stLib.isFile()||stLib.uid===65534||(stLib.mode&0o022))throw Error('SOURCE_TRUSTED_LIBRARY_DENIED');copies.set(path,realLib);
   }
  }
  for(const [dest,src] of copies){fs.mkdirSync(require('node:path').dirname(jail+dest),{recursive:true,mode:0o755});fs.copyFileSync(src,jail+dest,fs.constants.COPYFILE_EXCL);fs.chownSync(jail+dest,0,0);fs.chmodSync(jail+dest,pinnedBinaries.includes(dest)||/\/ld(?:-linux[^/]*|64|\.so[^/]*)$/.test(dest)?0o555:0o444);}
  fixed('/usr/bin/mount',['-t','tmpfs','-o','size=134217728,nr_inodes=8192,nosuid,nodev,noexec','tmpfs',work]);mounts.push(work);mounted=true;
  fs.chownSync(work,65534,65534);fs.chmodSync(work,0o700);
  fixed('/usr/bin/mount',['-t','proc','-o','ro,hidepid=2,nosuid,nodev,noexec','proc',jail+'/proc']);mounts.push(jail+'/proc');
  for(const name of ['null','zero','urandom']){const dest=jail+'/dev/'+name;fs.writeFileSync(dest,'',{mode:0o444,flag:'wx'});fixed('/usr/bin/mount',['--bind','/dev/'+name,dest]);mounts.push(dest);fixed('/usr/bin/mount',['-o','remount,bind,nosuid,noexec',dest]);}
  phase='trusted-inputs';fs.writeFileSync(trusted+'/protected','TRUSTED_SENTINEL',{mode:0o444,flag:'wx'});
  fs.writeFileSync(other+'/world-writable','OUTSIDE_SENTINEL',{mode:0o666,flag:'wx'});fs.chmodSync(other+'/world-writable',0o666);
  fs.writeFileSync(jail+'/world-writable','READONLY_SENTINEL',{mode:0o666,flag:'wx'});fs.chmodSync(jail+'/world-writable',0o666);fs.chmodSync(jail+'/tmp',0o777);
  fs.writeFileSync(trusted+'/filter.bpf',Buffer.from(payload.seccomp,'base64'),{mode:0o444,flag:'wx'});
  const programs={qualification:payload.probe,positive:'process.exitCode=0','seeded-failure':'process.exitCode=1',timeout:`require('node:child_process').spawn(process.execPath,['-e',"require('node:fs').writeFileSync('/work/timeout-child-started',String(process.pid));setTimeout(()=>{},60000)"],{stdio:'ignore'});setTimeout(()=>{},60000)`};if(payload.test)programs.notification=payload.test.program;
  for(const [label,code] of Object.entries(programs))fs.writeFileSync(trusted+'/'+label+'.cjs',code,{mode:0o444,flag:'wx'});
  fixed('/usr/bin/mount',['-o','remount,bind,ro,nosuid,nodev',jail]);
  function cleanChildOutput(text){try{const r=JSON.parse(text);if(r.version==='source-isolation-probe-v1'&&r.checks&&Object.values(r.checks).every(v=>typeof v==='boolean'))return{version:r.version,checks:r.checks,passed:r.passed===true,diagnostic:r.diagnostic&&Object.keys(r.diagnostic).sort().join(',')==='detachedError,detachedSignal,detachedStatus,kernelGroupCount,nodeGroupCount,socketFds'&&['EPERM','EACCES','EAGAIN','ENOSYS','ENOENT','UNKNOWN','EPIPE','EINVAL','ENOMEM',null].includes(r.diagnostic.detachedError)&&[null,'SIGKILL','SIGSYS','SIGABRT'].includes(r.diagnostic.detachedSignal)&&[null,0,1,127].includes(r.diagnostic.detachedStatus)&&Number.isSafeInteger(r.diagnostic.kernelGroupCount)&&Number.isSafeInteger(r.diagnostic.nodeGroupCount)&&Array.isArray(r.diagnostic.socketFds)&&r.diagnostic.socketFds.length<=256&&r.diagnostic.socketFds.every(n=>Number.isInteger(n)&&n>=0&&n<256)?r.diagnostic:null};const ids=["baseline-reproduces-stuck-notification-controls","patched-success-releases-current-controls","patched-error-releases-current-controls","patched-malformed-releases-current-controls","failed-read-preserves-refresh-result","duplicate-refresh-not-dispatched","newer-read-keeps-sync-time-and-tab"];if(r.version==='notification-source-behavioral-result-v1'&&Array.isArray(r.tests)&&r.tests.length===7&&r.tests.every((t,i)=>Object.keys(t).sort().join(',')==='id,passed'&&t.id===ids[i]&&typeof t.passed==='boolean'))return{version:r.version,tests:r.tests,passed:r.passed===true};return null;}catch{return null;}}
  async function run(label,code,ms){
   const file='/trusted/'+label+'.cjs';if(sha(fs.readFileSync(trusted+'/'+label+'.cjs'))!==sha(code))throw Error('SOURCE_TEST_HASH_FAILED');
   const args=['--nproc=64:64','--nofile=256:256','--core=0:0','--cpu=30:30','--fsize=134217728:134217728','--','/usr/bin/chroot',jail,'/usr/bin/setpriv','--no-new-privs','--bounding-set=-all','--inh-caps=-all','--ambient-caps=-all','--reuid=65534','--regid=65534','--clear-groups','--seccomp-filter=/trusted/filter.bpf','--','/usr/local/bin/node','--no-addons',file];
   const child=spawn('/usr/bin/prlimit',args,{cwd:work,env:{PATH:'/usr/local/bin',HOME:'/work',TMPDIR:'/work',QUAL_WORK:'/work',QUAL_TRUSTED:'/trusted',QUAL_OTHER:other},detached:true,stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='',bytes=0,limited=false,timedOut=false,spawnFailed=false;const sh=crypto.createHash('sha256'),eh=crypto.createHash('sha256');
   const kill=()=>{try{process.kill(-child.pid,'SIGKILL')}catch{}};
   child.stdout.on('data',b=>{sh.update(b);bytes+=b.length;if(bytes<=16000)stdout+=b.toString('utf8');else{limited=true;kill();}});
   child.stderr.on('data',b=>{eh.update(b);bytes+=b.length;if(bytes<=16000)stderr+=b.toString('utf8');if(bytes>16000){limited=true;kill();}});
   child.on('error',()=>{spawnFailed=true;});const timer=setTimeout(()=>{timedOut=true;kill();},ms);
   const end=await new Promise(resolve=>child.on('close',(exitCode,signal)=>resolve({exitCode,signal})));clearTimeout(timer);
   const diagnostic=spawnFailed?'spawn-failed':limited?'output-limit':timedOut?'timeout':end.exitCode===0?'completed':/landlock/i.test(stderr)?'landlock-setup-failed':/seccomp/i.test(stderr)?'seccomp-setup-failed':/unrecognized option|invalid argument/i.test(stderr)?'tool-option-unsupported':'nonzero-exit';
   const row={label,...end,timedOut,outputLimit:limited,spawnFailed,diagnostic,setupErrno:/Function not implemented/.test(stderr)?'ENOSYS':/Operation not supported/.test(stderr)?'EOPNOTSUPP':/Invalid argument/.test(stderr)?'EINVAL':/Operation not permitted/.test(stderr)?'EPERM':/Permission denied/.test(stderr)?'EACCES':null,programSha256:sha(code),stdoutSha256:sh.digest('hex'),stderrSha256:eh.digest('hex'),output:limited?null:cleanChildOutput(stdout)};results.push(row);return row;
  }
  phase='child-qualification';const qual=await run('qualification',payload.probe,45000);
  const checks=qual.output?.checks;
  const expectedChecks=['uidGid','noNewPrivileges','capabilitiesZero','groupsEmpty','protectedRead','workWrite','protectedWrite','outsideWrite','symlinkEscape','traversalEscape','outsideTmp','otherWorkspaceRead','otherExecutable','networkSockets','stdioSocketsOnly','scratchQuota','diskDenial','descriptorDenial','processThreadDenial','processGroupEscapeDenied','readOnlyRoot','readOnlyProc','outsideSentinelAbsent'];
  qualificationPassed=!!(qual.exitCode===0&&!qual.timedOut&&!qual.outputLimit&&qual.output?.passed===true&&checks&&Object.keys(checks).sort().join(',')===expectedChecks.sort().join(',')&&Object.values(checks).every(v=>v===true));
  if(!qualificationPassed)throw Error('SOURCE_ISOLATION_QUALIFICATION_FAILED');
  phase='exit-classification';const positive=await run('positive',"process.exitCode=0",2000),negative=await run('seeded-failure',"process.exitCode=1",2000);
  if(positive.exitCode!==0||negative.exitCode!==1)throw Error('SOURCE_TEST_EXIT_CLASSIFICATION_FAILED');
  phase='timeout';const timeout=await run('timeout',programs.timeout,1000);
  let startedPid='';try{startedPid=fs.readFileSync(work+'/timeout-child-started','utf8');}catch{}timeout.childStarted=/^[1-9][0-9]*$/.test(startedPid);if(!timeout.timedOut||timeout.exitCode===0||!timeout.childStarted)throw Error('SOURCE_TEST_TIMEOUT_FAILED');
  const activeTargets=()=>fs.readdirSync('/proc').filter(n=>/^[0-9]+$/.test(n)).filter(n=>{try{const s=fs.readFileSync('/proc/'+n+'/status','utf8');if(!/^Uid:\s+[0-9]+\s/m.test(s)||!/^State:\s+[A-Za-z]/m.test(s))throw Error('SOURCE_TEST_PROCESS_STATE_UNCONFIRMED');return /^Uid:\s+65534\s/m.test(s)&&!/^State:\s+Z/m.test(s);}catch(e){if(e.code==='ENOENT')return false;throw Error('SOURCE_TEST_PROCESS_STATE_UNCONFIRMED');}}).length;
  for(let i=0;i<50&&activeTargets();i++)await new Promise(resolve=>setTimeout(resolve,20));
  if(activeTargets())throw Error('SOURCE_TEST_DESCENDANT_CLEANUP_FAILED');timeout.descendantsTerminated=true;
  phase='notification';if(payload.test){if(sha(payload.test.program)!==payload.test.programSha256)throw Error('SOURCE_TEST_HASH_FAILED');const test=await run('notification',payload.test.program,20000);if(test.exitCode!==0||test.timedOut||test.outputLimit||test.spawnFailed||test.output?.passed!==true||!test.output.tests.every(t=>t.passed===true))throw Error('SOURCE_NOTIFICATION_TESTS_FAILED');}
  if(fs.readFileSync(trusted+'/protected','utf8')!=='TRUSTED_SENTINEL'||fs.readFileSync(other+'/world-writable','utf8')!=='OUTSIDE_SENTINEL')throw Error('SOURCE_TEST_PROTECTED_INTEGRITY_FAILED');
  report={version:'source-isolated-runner-result-v1',mode:payload.mode,programSha256:sha(process.execArgv[1]),qualificationPassed:true,runPassed:true,results,sourceHashes:payload.test?.sourceHashes||null,testProgramSha256:payload.test?.programSha256||null,protectedIntegrity:true,publicationAuthorized:false,independentlyAccepted:false};
 }catch(e){const codes=['SOURCE_ISOLATION_QUALIFICATION_FAILED','SOURCE_TEST_EXIT_CLASSIFICATION_FAILED','SOURCE_TEST_TIMEOUT_FAILED','SOURCE_TEST_DESCENDANT_CLEANUP_FAILED','SOURCE_TEST_PROCESS_STATE_UNCONFIRMED','SOURCE_TEST_HASH_FAILED','SOURCE_NOTIFICATION_TESTS_FAILED','SOURCE_TEST_PROTECTED_INTEGRITY_FAILED'];report={version:'source-isolated-runner-result-v1',mode:payload.mode,programSha256:sha(process.execArgv[1]),qualificationPassed,runPassed:false,results,phase,code:codes.includes(e?.message)?e.message:'SOURCE_ISOLATION_SETUP_FAILED',setupStatus:Number.isInteger(e?.status)?e.status:null,publicationAuthorized:false};process.exitCode=1;}
 finally{let clean=true;if(mounted){for(const path of mounts.reverse()){try{fixed('/usr/bin/umount',[path]);}catch{clean=false;}}}if(clean)try{fs.rmSync(root,{recursive:true,force:true});}catch{clean=false;}report.cleanupConfirmed=clean;if(!clean){report.runPassed=false;report.code='SOURCE_GUEST_CLEANUP_FAILED';process.exitCode=1;}}
 const output=JSON.stringify(report)+'\n';for(let offset=0;offset<output.length;offset+=1200){process.stdout.write(output.slice(offset,offset+1200));await new Promise(resolve=>setTimeout(resolve,25));}
}
async function qualificationProbe(){
 const fs=require('node:fs'),net=require('node:net'),dns=require('node:dns').promises,{spawnSync}=require('node:child_process'),{Worker}=require('node:worker_threads');
 const work=process.env.QUAL_WORK,trusted=process.env.QUAL_TRUSTED,other=process.env.QUAL_OTHER,checks={},diagnostic={};
 const status=fs.readFileSync('/proc/self/status','utf8');const value=k=>status.split('\n').find(s=>s.startsWith(k+':'))?.split(':')[1].trim();
 checks.uidGid=process.getuid()===65534&&process.getgid()===65534;
 checks.noNewPrivileges=value('NoNewPrivs')==='1';
 checks.capabilitiesZero=['CapEff','CapPrm','CapInh','CapAmb','CapBnd'].every(k=>/^0{16}$/.test(value(k)||''));
 diagnostic.kernelGroupCount=(value('Groups')||'').split(/\s+/).filter(Boolean).length;diagnostic.nodeGroupCount=process.getgroups().length;checks.groupsEmpty=value('Groups')!==undefined&&diagnostic.kernelGroupCount===0&&process.getgroups().every(g=>g===65534);const mounts=fs.readFileSync('/proc/self/mountinfo','utf8').trim().split('\n').map(line=>line.split(' '));const readOnly=path=>{const matches=mounts.filter(row=>row[4]===path);return matches.length===1&&matches[0][5].split(',').includes('ro');};checks.readOnlyRoot=readOnly('/');checks.readOnlyProc=readOnly('/proc');
 checks.protectedRead=fs.readFileSync(trusted+'/protected','utf8')==='TRUSTED_SENTINEL';
 const denied=fn=>{try{fn();return false}catch(e){return ['EACCES','EPERM','EROFS'].includes(e.code)}};
 fs.writeFileSync(work+'/allowed','OK');checks.workWrite=fs.readFileSync(work+'/allowed','utf8')==='OK';
 checks.protectedWrite=denied(()=>fs.appendFileSync(trusted+'/protected','BAD'));
 checks.outsideWrite=denied(()=>fs.appendFileSync('/world-writable','BAD'));
 fs.symlinkSync('/world-writable',work+'/escape');checks.symlinkEscape=denied(()=>fs.appendFileSync(work+'/escape','BAD'));
 checks.traversalEscape=denied(()=>fs.appendFileSync(work+'/../world-writable','BAD'));
 checks.outsideTmp=denied(()=>fs.writeFileSync('/tmp/callercore-forbidden','BAD'));
 try{fs.readFileSync(other+'/world-writable');checks.otherWorkspaceRead=false;}catch(e){checks.otherWorkspaceRead=e.code==='ENOENT';}checks.outsideSentinelAbsent=checks.otherWorkspaceRead;
 const exec=spawnSync('/usr/bin/true',[],{stdio:'ignore',timeout:1000});checks.otherExecutable=['ENOENT','EACCES','EPERM'].includes(exec.error?.code);
 const groupProbe="const fs=require('node:fs');const s=fs.readFileSync('/proc/self/status','utf8');const take=k=>s.split('\\n').find(l=>l.startsWith(k+':'))?.split(':')[1].trim();process.stdout.write(JSON.stringify({group:take('NSpgid'),session:take('NSsid')}));";const escape=spawnSync('/usr/local/bin/node',['-e',groupProbe],{detached:true,stdio:['ignore','pipe','ignore'],timeout:1000,encoding:'utf8',maxBuffer:1024});diagnostic.detachedError=escape.error?.code||null;diagnostic.detachedStatus=escape.status;diagnostic.detachedSignal=escape.signal;let inheritedGroup=false;try{const child=JSON.parse(escape.stdout);inheritedGroup=Object.keys(child).sort().join(',')==='group,session'&&/^[0-9]+$/.test(child.group)&&/^[0-9]+$/.test(child.session)&&child.group===value('NSpgid')&&child.session===value('NSsid');}catch{}const pipeConfined=escape.error?.code==='EPERM'||escape.status===0&&inheritedGroup;const ignored=spawnSync('/usr/local/bin/node',['-e',groupProbe.replace('process.stdout.write(',"fs.writeFileSync('/work/detached-scope.json',")],{detached:true,stdio:'ignore',timeout:1000});let ignoredConfined=ignored.error?.code==='EPERM';if(!ignoredConfined&&ignored.status===0){try{const child=JSON.parse(fs.readFileSync('/work/detached-scope.json','utf8'));ignoredConfined=Object.keys(child).sort().join(',')==='group,session'&&/^[0-9]+$/.test(child.group)&&/^[0-9]+$/.test(child.session)&&child.group===value('NSpgid')&&child.session===value('NSsid');}catch{}}checks.processGroupEscapeDenied=pipeConfined&&ignoredConfined;
 checks.networkSockets=await new Promise(resolve=>{const s=new net.Socket();const t=setTimeout(()=>{s.destroy();resolve(false)},1000);s.on('error',e=>{clearTimeout(t);resolve(['EPERM','EACCES'].includes(e.code));});s.connect(9,'192.0.2.1',()=>{clearTimeout(t);s.destroy();resolve(false);});});
 // A reserved-name DNS failure alone proves nothing. Socket creation is denied
 // and no socket descriptors may have survived exec, covering DNS and VSOCK.
 let descriptorReadConfirmed=true;diagnostic.socketFds=fs.readdirSync('/proc/self/fd').filter(n=>{try{return fs.readlinkSync('/proc/self/fd/'+n).startsWith('socket:');}catch(e){if(e.code!=='ENOENT')descriptorReadConfirmed=false;return false;}}).map(Number);checks.stdioSocketsOnly=descriptorReadConfirmed&&diagnostic.socketFds.every(n=>n===1||n===2);
 try{await dns.lookup('callercore-qualification.invalid');}catch{}
 const stats=fs.statfsSync(work);checks.scratchQuota=Number(stats.bsize)*Number(stats.blocks)===134217728&&Number(stats.files)<=8192;
 let exhausted=false;const block=Buffer.alloc(8*1024*1024);let files=0;try{for(;files<17;files++)fs.writeFileSync(work+'/fill-'+files,block);}catch(e){exhausted=e.code==='ENOSPC';}finally{for(let i=0;i<=files;i++){try{fs.unlinkSync(work+'/fill-'+i)}catch{}}}checks.diskDenial=exhausted;
 const fd=[];let fdDenied=false;try{for(let i=0;i<300;i++)fd.push(fs.openSync(work+'/allowed','r'));}catch(e){fdDenied=e.code==='EMFILE';}finally{fd.forEach(n=>fs.closeSync(n));}checks.descriptorDenial=fdDenied;
 const workers=[];let threadDenied=false;try{for(let i=0;i<80;i++){const w=new Worker('setTimeout(()=>{},5000)',{eval:true});w.on('error',()=>{});workers.push(w);}}catch(e){threadDenied=e.code==='ERR_WORKER_INIT_FAILED'&&/EAGAIN/.test(e.message);}finally{await Promise.all(workers.map(w=>w.terminate()));}checks.processThreadDenial=threadDenied;
 process.stdout.write(JSON.stringify({version:'source-isolation-probe-v1',checks,diagnostic,passed:Object.values(checks).every(v=>v===true)})+'\n');process.exitCode=Object.values(checks).every(v=>v===true)?0:1;
}
module.exports={command};
