const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/demo-number.js','utf8');
const secret='isolated-demo-token-test-secret-32-characters';
function harness({limited=false,available=false,environment='preview',signingSecret=secret}={}){
  let limits=0,readiness=0;
  const env={VERCEL_ENV:environment,DEMO_TOKEN_SECRET:signingSecret,DEMO_PHONE_NUMBER:'+15095550100',DEMO_PHONE_NUMBER_DISPLAY:'(509) 555-0100'};
  const context={module:{exports:{}},process:{env},Buffer,URL,require(name){
    if(name==='crypto')return crypto;
    if(name==='../lib/rate-limit')return {requestIp:()=> '192.0.2.1',rateLimit:async options=>{limits++;assert.equal(options.failClosed,true);return {limited,retryAfter:60}}};
    if(name==='../lib/kv')return {kv:{}};
    if(name==='../lib/voice-demo')return {demoReadiness:async()=>{readiness++;return {available}}};
    throw Error('Unexpected dependency');
  }};
  vm.runInNewContext(source,context);
  async function request(token,headers={origin:'https://www.callercore.com',host:'www.callercore.com'}){
    const result={status:0,headers:{},body:null};
    const res={setHeader:(k,v)=>{result.headers[k]=v},status(n){result.status=n;return this},json(body){result.body=body;return this},end(){return this}};
    await context.module.exports({method:'POST',headers,body:{token}},res);return result;
  }
  return {request,counts:()=>({limits,readiness})};
}
function token(age=2000){const ts=String(Date.now()-age);return ts+'.'+crypto.createHmac('sha256',secret).update(ts).digest('hex')}

test('rate-limited demo requests cannot read readiness records even while unavailable',async()=>{
  const h=harness({limited:true});const r=await h.request(token());
  assert.equal(r.status,429);assert.equal(r.headers['Retry-After'],'60');
  assert.deepEqual(h.counts(),{limits:1,readiness:0});assert.equal(r.body.number,undefined);
});
test('invalid, forged and expired demo tokens cannot read readiness records',async()=>{
  for(const [value,status] of [[undefined,400],['invalid',400],[String(Date.now()-2000)+'.'+'0'.repeat(64),403],[token(600000),403]]){
    const h=harness();const r=await h.request(value);assert.equal(r.status,status);
    assert.deepEqual(h.counts(),{limits:1,readiness:0});assert.equal(r.body.number,undefined);
  }
});
test('only admitted signed demo requests reach readiness and unavailable state never reveals a number',async()=>{
  const h=harness();const r=await h.request(token());assert.equal(r.status,503);
  assert.deepEqual(h.counts(),{limits:1,readiness:1});assert.equal(r.body.number,undefined);
  const approved=harness({available:true});const ok=await approved.request(token());
  assert.equal(ok.status,200);assert.equal(ok.body.number,'+15095550100');
  assert.deepEqual(approved.counts(),{limits:1,readiness:1});
});
test('origin denial and existing Production behavior remain separate from Preview readiness',async()=>{
  const denied=harness();assert.equal((await denied.request(token(),{origin:'https://example.invalid',host:'www.callercore.com'})).status,403);
  assert.deepEqual(denied.counts(),{limits:0,readiness:0});
  const production=harness({environment:'production'});assert.equal((await production.request(token())).status,200);
  assert.deepEqual(production.counts(),{limits:1,readiness:0});
});
test('unconfigured or weak signing credentials fail closed without touching rate or readiness storage',async()=>{
  for(const signingSecret of ['', 'short']){
    const h=harness({signingSecret});
    for(let i=0;i<8;i++){const r=await h.request(token());assert.equal(r.status,503);assert.equal(r.body.number,undefined);}
    assert.deepEqual(h.counts(),{limits:0,readiness:0});
  }
});
