'use strict';
// Offline preparation only. No credentials, fetch, controller mutation or model call.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),discovery=require('../lib/agent-operations-engineering-discovery');
function main(args=process.argv.slice(2)){
 const [name,...rest]=args,mode=rest[0]==='--read'?'read':'catalog',ids=mode==='read'?rest.slice(1):rest;
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(name||'')||ids.some(id=>!/^source-\d+$/.test(id)))throw Error('Use <new-artifact-name> [source-ID ...]');
 const git=a=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 if(git(['status','--porcelain','--untracked-files=all']))throw Error('Commit reviewed source before preparing source identity');
 const identity={sourceCommit:require('./development-checkpoint.cjs').applicationSource(),release:require('../lib/agent-operations-contracts').assertRelease()};
 const context=discovery.packet(identity,{evidenceIds:ids,mode}),request=require('../lib/agent-operations-chief-model').request(context);
 const dir=path.join(root,'artifacts/agent-operations');fs.mkdirSync(dir,{recursive:true});
 const result={version:discovery.VERSION,context,request,qualification:'Local prepared request, not verified Preview admission or a paid authorization. No model reasoning has occurred.'};
 fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({artifact:name+'.json',sourceCommit:identity.sourceCommit,contextHash:context.hash,catalogEntries:context.body.catalog.length,suppliedExcerpts:context.body.evidence.length,requestBytes:Buffer.byteLength(JSON.stringify(request.body)),modelCalls:0,executionAuthorized:false}));
}
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={main};
