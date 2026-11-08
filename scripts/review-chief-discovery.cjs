'use strict';
// Offline import of an exported response. Provenance is explicitly unverified;
// this is not a second provider transport, paid controller or executor.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'artifacts/agent-operations'),chief=require('../lib/agent-operations-chief-model'),discovery=require('../lib/agent-operations-engineering-discovery');
function read(name){const file=path.join(dir,name+'.json');if(!/^[a-zA-Z0-9_-]{1,80}$/.test(name||'')||fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>2000000)throw Error('ENG_DISCOVERY_IMPORT');return JSON.parse(fs.readFileSync(file,'utf8'));}
function main(args=process.argv.slice(2)){
 const [preparedName,responseName,outputName]=args;
 if(args.length!==3||!/^[a-zA-Z0-9_-]{1,80}$/.test(outputName||''))throw Error('ENG_DISCOVERY_IMPORT');
 const prepared=read(preparedName),provider=read(responseName);
 if(prepared.version!==discovery.VERSION)throw Error('ENG_DISCOVERY_IMPORT');
 const parsed=chief.receipt(provider,prepared.context),context=parsed.proposal.decision.decision==='inspect'?discovery.readSelection(parsed.proposal,prepared.context):null;
 const result={version:discovery.VERSION,provenance:'operator-imported-export-not-independently-verified-provider-execution',receipt:parsed,...(context?{context,request:chief.request(context)}:{}),qualification:'Validated source-bound data only. No task registration, paid dispatch, test permission, acceptance or publication.'};
 fs.writeFileSync(path.join(dir,outputName+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({artifact:outputName+'.json',decision:parsed.proposal.decision.decision,contextHash:parsed.proposal.contextHash,modelCalls:0,executionAuthorized:false}));
}
if(require.main===module)try{main();}catch(e){console.error(/^ENG_DISCOVERY_[A-Z_]+$/.test(e.message)?e.message:'ENG_DISCOVERY_IMPORT_DENIED');process.exitCode=1;}
module.exports={main};
