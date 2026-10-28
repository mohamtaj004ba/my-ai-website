'use strict';
// Trusted supervisor reports on the direct backend stream, not Work's older
// connector. Both encoded and decoded output retain the existing 16 KB bound.
// Serialized into the qualified guest; never evaluates generated source here.
async function writeReport(report){
 const crypto=require('node:crypto'),zlib=require('node:zlib'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 const encode=value=>{const raw=JSON.stringify(value);if(Buffer.byteLength(raw)>16000)throw Error('SOURCE_TEST_RESULT_TRANSPORT_LIMIT');const data=zlib.brotliCompressSync(Buffer.from(raw),{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}}).toString('base64');const text=JSON.stringify({version:'source-test-result-br-v1',encoding:'brotli-base64',sha256:sha(raw),bytes:Buffer.byteLength(raw),data})+'\n';if(Buffer.byteLength(text)>16000)throw Error('SOURCE_TEST_RESULT_TRANSPORT_LIMIT');return text;};
 let output;
 try{output=encode(report);}catch{
  process.exitCode=1;
  output=encode({version:'source-isolated-runner-result-v1',mode:report.mode,programSha256:report.programSha256,qualificationPassed:report.qualificationPassed===true,runPassed:false,phase:'result-encoding',code:'SOURCE_TEST_RESULT_TRANSPORT_LIMIT',cleanupConfirmed:report.cleanupConfirmed===true,publicationAuthorized:false,independentlyAccepted:false,results:[]});
 }
 for(let offset=0;offset<output.length;offset+=1200){process.stdout.write(output.slice(offset,offset+1200));await new Promise(resolve=>setTimeout(resolve,25));}
}
module.exports={writeReport};
