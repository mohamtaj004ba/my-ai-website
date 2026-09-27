const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
const start=source.indexOf('async function adminAiFeedback(req,res){');
const end=source.indexOf('\nasync function adminAiFeedbackUpdate(',start);
assert.ok(start>=0&&end>start,'admin feedback read handler found');

function fixture(count,{rawIndex,missing=[],denied=false}={}){
  const ids=rawIndex===undefined?Array.from({length:count},(_,i)=>'feedback-'+i):rawIndex;
  let status=0,result,reads=0,concurrent=0,peak=0;
  const context=vm.createContext({
    requireAdmin:async()=>denied?null:{email:'admin@example.test'},
    kv:{get:async key=>{
      if(key==='ai-feedback:index')return ids;
      reads++;concurrent++;peak=Math.max(peak,concurrent);
      await Promise.resolve();concurrent--;
      const id=key.slice('ai-feedback:'.length);
      return missing.includes(id)?null:{id,workspaceId:'workspace-'+id,status:'submitted',
        createdAt:Number(id.split('-').at(-1))||0};
    }},
    req:{},res:{status(n){status=n;return this},json(x){result=x;return x}},
    Array,Set,Number,String,Promise
  });
  vm.runInContext(source.slice(start,end),context);
  return {run:async()=>{await vm.runInContext('adminAiFeedback(req,res)',context);return {status,result,reads,peak}}};
}
test('admin Client Care includes indexed feedback beyond old first-500 cutoff',async()=>{
  const x=await fixture(551).run();
  assert.equal(x.status,200);
  assert.equal(x.result.feedback.length,551);
  assert.ok(x.result.feedback.some(y=>y.id==='feedback-550'));
  assert.equal(x.reads,551);
  assert.ok(x.peak<=40);
});
test('missing earlier feedback records do not mask later indexed cases',async()=>{
  const x=await fixture(570,{missing:['feedback-4','feedback-502']}).run();
  assert.equal(x.status,200);
  assert.equal(x.result.feedback.length,568);
  assert.ok(x.result.feedback.some(y=>y.id==='feedback-569'));
});
test('malformed, duplicate and over-capacity indexes never appear as a complete inbox',async()=>{
  for(const rawIndex of [{bad:true},['feedback-one','feedback-one'],['feedback-one',12],
    Array.from({length:1501},(_,i)=>'feedback-'+i)]){
    const x=await fixture(0,{rawIndex}).run();
    assert.equal(x.status,503);
    assert.match(x.result.error,/No partial feedback list/);
    assert.equal(x.reads,0);
  }
});
test('empty indexed feedback has an explicit authorized zero-item result',async()=>{
  const x=await fixture(0).run();
  assert.equal(x.status,200);
  assert.equal(x.result.feedback.length,0);
});
test('unauthorized request never reads feedback index',async()=>{
  const x=await fixture(5,{denied:true}).run();
  assert.equal(x.status,0);
  assert.equal(x.reads,0);
});
