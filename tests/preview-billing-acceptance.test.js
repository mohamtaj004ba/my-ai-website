const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto'),Module=require('module');
const token='a'.repeat(64),source=fs.readFileSync('lib/preview-billing-acceptance.js','utf8').replace(/const TOKEN_HASH='[^']+'/,'const TOKEN_HASH='+JSON.stringify(crypto.createHash('sha256').update(token).digest('hex')));
const filename=require.resolve('../lib/preview-billing-acceptance'),mod=new Module(filename);mod.filename=filename;mod._compile(source,filename);const gate=mod.exports;
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/callercore-dashboards'},req={headers:{host:'test.vercel.app','x-billing-acceptance':token},body:{native:true,email:'stripe-acceptance-'+gate.RUN+'-starter@callercore.test'}};
test('acceptance requires authenticated, unexpired, named Preview; production always rejects',()=>{
 assert.equal(gate.checkoutAllowed(req,env,gate.EXPIRES-1),true);
 for(const changes of [{VERCEL_ENV:'production'},{VERCEL_ENV:'development'},{VERCEL_GIT_COMMIT_REF:'main'}])assert.equal(gate.allowed(req,{...env,...changes},gate.EXPIRES-1),false);
 assert.equal(gate.allowed(req,env,gate.EXPIRES),false);
 assert.equal(gate.allowed({...req,headers:{host:'www.callercore.com','x-billing-acceptance':token}},env,gate.EXPIRES-1),false);
 assert.equal(gate.allowed({...req,headers:{host:'test.vercel.app'},query:{token}},env,gate.EXPIRES-1),false);
 assert.equal(gate.allowed({...req,headers:{host:'test.vercel.app','x-billing-acceptance':'b'.repeat(64)}},env,gate.EXPIRES-1),false);
 assert.equal(gate.allowed({...req,headers:{host:'test.vercel.app',cookie:'cc_billing_acceptance='+token}},env,gate.EXPIRES-1),true);
});
test('acceptance cannot open checkout for real or arbitrary identities or legacy requests',()=>{
 for(const email of ['owner@callercore.com','customer@example.com','stripe-acceptance-'+gate.RUN+'-other@callercore.test'])assert.equal(gate.checkoutAllowed({...req,body:{native:true,email}},env,gate.EXPIRES-1),false);
 assert.equal(gate.checkoutAllowed({...req,body:{...req.body,native:false}},env,gate.EXPIRES-1),false);
});
