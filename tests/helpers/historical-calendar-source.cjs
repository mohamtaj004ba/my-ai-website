'use strict';
// Tests-only frozen replay. Never rewrites the repository, guards or proposals.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const profile=require('../../lib/agent-operations-engineering-calendar-boundaries');
const sourcePath=fs.realpathSync(require.resolve('../../dashboard.js'));
const manifestPath=fs.realpathSync(require.resolve('../../lib/agent-operations-engineering-source-lock.json'));
const PIN='441484e8a28273bb17eb0c1533b306935c30e00526a5cfc68a8e75b011fad5a6';
const hash=x=>createHash('sha256').update(x).digest('hex');
function historicalText(){let text=fs.readFileSync(sourcePath,'utf8').replace(/\r\n/g,'\n');if(hash(text)!==PIN){for(const e of [...profile.EDITS].reverse()){if(text.split(e.afterText).length!==2)throw Error('HISTORICAL_CALENDAR_INVERSE_MISMATCH');text=text.replace(e.afterText,e.beforeText);}}if(hash(text)!==PIN)throw Error('HISTORICAL_CALENDAR_HASH_MISMATCH');return text;}
async function withHistorical(fn){
 const contracts=require('../../lib/agent-operations-contracts');contracts.assertRelease();
 const text=historicalText(),originalRead=fs.readFileSync,lock=require('../../lib/agent-operations-engineering-source-lock.json'),entry=lock.files.find(f=>f.path==='dashboard.js'),saved={...entry},releaseLock=require('../../lib/agent-operations-contract-lock.json'),savedRelease={...releaseLock};
 fs.readFileSync=function(file,options){if(typeof file==='string'&&[sourcePath,manifestPath].includes(path.resolve(file))){const value=path.resolve(file)===sourcePath?text:JSON.stringify(lock),encoding=typeof options==='string'?options:options?.encoding;return encoding?Buffer.from(value).toString(encoding):Buffer.from(value);}return originalRead.apply(this,arguments);};
 Object.assign(entry,{sha256:PIN,bytes:Buffer.byteLength(text)});
 // Recompute the actual fixture release; assertRelease itself remains untouched.
 // This proves internal fixture consistency, never current deployed identity.
 try{Object.assign(releaseLock,contracts.release());contracts.assertRelease();return await fn();}finally{fs.readFileSync=originalRead;Object.assign(entry,saved);Object.assign(releaseLock,savedRelease);contracts.assertRelease();}
}
module.exports={PIN,historicalText,withHistorical};
