'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('curated source adapter imports as metadata without granting source-file reads',()=>{
 const lib=path.resolve('lib'),code="const t=require('./lib/agent-operations-engineering-tools');if(t.VERSION!=='engineering-read-tools-v1')throw Error('Metadata drift');let denied=false;try{t.readFile('dashboard.html')}catch(e){if(e.code==='ERR_ACCESS_DENIED')denied=true;else throw e}if(!denied)throw Error('Source read unexpectedly permitted');console.log('metadata-import-only; source-read-denied');";
 const r=spawnSync(process.execPath,['--permission','--allow-fs-read='+lib,'-e',code],{env:{},encoding:'utf8',windowsHide:true,timeout:3000});a.equal(r.status,0,r.stderr);a.equal(r.stdout.trim(),'metadata-import-only; source-read-denied');
});
