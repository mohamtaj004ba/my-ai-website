'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'agent-operations-engineering-review-ui.test.js'),prefix=fs.readFileSync(file,'utf8').split('\ntest(')[0],{harness,state}=new Function('require','__dirname',prefix+'\nreturn {harness,state};')(Module.createRequire(file),__dirname);
const methods=['configurationReview','stopReviewedConsent','cleanupReconcile','configurationClaim','configurationStep','configurationStatus','configurationComplete','configurationCancel','configurationRejectionReconcile'];
for(const method of methods)test('every configuration control preserves a safe denial without exposing raw content: '+method,async()=>{
 const id='refresh_'+'3'.repeat(32),h=harness(async()=>({__response:true,status:409,body:{code:'ENG_CONFIG_SEQUENCE',error:'PRIVATE_PROVIDER_BODY',headers:{Authorization:'PRIVATE_HEADER'}}}));h.update(state());h.get('opsEngineeringConfigurationInput').value=JSON.stringify({intent:{id}});await h.get('opsEngineering'+method).emit('click');
 const text=h.get('opsEngineeringConfigurationResult').textContent;a.match(text,/Code: ENG_CONFIG_SEQUENCE\./);a.doesNotMatch(text,/PRIVATE_PROVIDER_BODY|PRIVATE_HEADER/);a.equal(h.calls.length,1);a.equal(h.calls[0].action,'operations-engineering-activation-'+method);a.match(text,/No automatic retry/);
});
for(const code of ['ENG_CONSENT_POLICY','ENG_CONSENT_SCOPE','ENG_CONSENT_REVOKED_OR_SCOPE','ENG_PRIVATE_CUSTOMER_DATA','sk-proj-PRIVATE'])test('reviewed consent error sanitization: '+code,async()=>{
 const h=harness(async()=>({__response:true,status:409,body:{code,error:'RAW_SECRET'}}));h.update(state());h.get('opsEngineeringConfigurationInput').value=JSON.stringify({intent:{id:'refresh_'+'4'.repeat(32)}});await h.get('opsEngineeringconfigurationReview').emit('click');const text=h.get('opsEngineeringConfigurationResult').textContent;
 if(code.startsWith('ENG_CONSENT_'))a(text.includes('Code: '+code+'.'));else a.doesNotMatch(text,/Code:|PRIVATE/);a.doesNotMatch(text,/RAW_SECRET/);a.equal(h.calls.length,1);
});
