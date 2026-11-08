'use strict';
// Emit a reviewable immutable evidence candidate. No admission, grants or execution.
const fs=require('node:fs'),tools=require('../lib/agent-operations-engineering-tools');
function prepare(previous,next,expectedPreviousHash){
 if(!Number.isSafeInteger(previous)||previous<1||!Number.isSafeInteger(next)||next!==previous+1)throw Error('Adjacent evidence versions required');
 const old=require('../lib/agent-operations-engineering-inference-evidence-v'+previous+'.json'),capture=tools.captureApproved();
 if(!/^[a-f0-9]{64}$/.test(expectedPreviousHash||'')||tools.hash(old)!==expectedPreviousHash||old.version!=='engineering-inference-evidence-v'+previous||old.profile!=='engineering-inference-rehearsal-v1')throw Error('Authenticated previous evidence required');
 const evidence=old.evidence.map(e=>{const text=capture.texts[e.path],file=capture.manifest.files.find(f=>f.path===e.path);if(!file||tools.hash(e.text)!==e.excerptHash)throw Error('Evidence anchor integrity required');const matches=text.split('\n').flatMap((line,i)=>line===e.text?[i+1]:[]);if(matches.length!==1)throw Error('Unique unchanged evidence anchor required');return{...e,line:matches[0],sha256:file.sha256};});
 const candidate={...old,version:'engineering-inference-evidence-v'+next,evidence},target='lib/agent-operations-engineering-inference-evidence-v'+next+'.json';
 fs.writeFileSync(target,JSON.stringify(candidate,null,2)+'\n',{flag:'wx'});return{target,sha256:tools.hash(candidate),executionAuthorized:false,requiresReviewedSelection:true};
}
if(require.main===module)console.log(JSON.stringify(prepare(Number(process.argv[2]),Number(process.argv[3]),process.argv[4])));
module.exports={prepare};
