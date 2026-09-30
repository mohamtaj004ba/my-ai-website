const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');

function feedbackApiFixture(raw,{missing=[]}={}){
  let status=0,payload,reads=0;
  const values=new Map();
  if(raw!==null)values.set('ai-feedback:workspace:client',raw);
  if(Array.isArray(raw))for(const id of raw)if(typeof id==='string'&&!missing.includes(id))values.set('ai-feedback:'+id,{id,workspaceId:'client',createdAt:Number(id.split('-').pop())||0});
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'client'}),aiFeedbackWorkspaceIndexKey:id=>'ai-feedback:workspace:'+id,
    kv:{get:async key=>{reads++;return values.get(key)??null}},req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},
    Array,Set,Number,String,Promise
  });
  const start=api.indexOf('async function aiFeedback(req,res){'),end=api.indexOf('\nasync function aiFeedbackSubmit(',start);
  vm.runInContext(api.slice(start,end),ctx);
  return {run:async()=>{await vm.runInContext('aiFeedback(req,res)',ctx);return {status,payload,reads}}};
}
test('client feedback history returns all indexed workspace records instead of the old 60-item window',async()=>{
  const ids=Array.from({length:125},(_,i)=>'feedback-'+i),r=await feedbackApiFixture(ids).run();
  assert.equal(r.status,200);assert.equal(r.payload.feedback.length,125);
  assert.equal(r.payload.coverage.verified,true);assert.equal(r.payload.coverage.incomplete,false);
});
test('missing indexed client feedback records are disclosed without leaking a foreign record',async()=>{
  const ids=['feedback-1','feedback-2','feedback-3'],f=feedbackApiFixture(ids,{missing:['feedback-2']});
  const r=await f.run();assert.equal(r.status,200);assert.deepEqual(Array.from(r.payload.feedback,x=>x.id),['feedback-3','feedback-1']);
  assert.equal(r.payload.coverage.incomplete,true);assert.equal(r.payload.coverage.missingRecords,1);
});
test('malformed duplicate or over-capacity client feedback index fails closed',async()=>{
  for(const raw of [{bad:true},['same','same'],['valid',42],Array.from({length:251},(_,i)=>'feedback-'+i)]){
    const r=await feedbackApiFixture(raw).run();assert.equal(r.status,503);assert.match(r.payload.error,/No partial feedback history/);
  }
});
test('client feedback UI exposes retryable incomplete/unverified history states',()=>{
  assert.match(html,/id="clientFeedbackHistoryHealth"[^>]*role="status"/);
  assert.match(html,/id="clientFeedbackHistoryRetry"/);
  assert.match(dashboard,/Feedback history may be incomplete/);
  assert.match(dashboard,/Feedback history not verified/);
  assert.match(dashboard,/clientFeedbackHistoryRetry/);
});
