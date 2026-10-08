const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('async function submitAiFeedback(');
const end=source.indexOf('\nfunction openCallFeedbackModal(',start);
assert.ok(start>=0&&end>start,'AI feedback submit handler found');

function fixture(){
  const status={textContent:''},button={disabled:false,textContent:'Send feedback'};
  const message={value:'',setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true}};
  let renders=0;
  const ctx=vm.createContext({
    demoMode:true,clientFeedbackData:[],Date,Array,String,
    renderClientFeedback:()=>{renders++},
    fetch:async()=>{throw Error('demo feedback must not fetch')}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,status,button,message,renders:()=>renders,submit:value=>vm.runInContext('submitAiFeedback',ctx)({source:'call',message:value,button,statusEl:status,messageEl:message})};
}

test('AI feedback validation marks and focuses an empty description',async()=>{
  const f=fixture();
  assert.equal(await f.submit('   '),false);
  assert.equal(f.message['aria-invalid'],'true');
  assert.equal(f.message.focused,true);
  assert.match(f.status.textContent,/short description/i);
  assert.equal(f.renders(),0);
});

test('valid AI feedback clears invalid state before confirmed local submission',async()=>{
  const f=fixture();f.message['aria-invalid']='true';
  assert.equal(await f.submit('Please ask for the model number.'),true);
  assert.equal(f.message['aria-invalid'],undefined);
  assert.equal(f.renders(),1);
  assert.equal(f.ctx.clientFeedbackData.length,1);
  assert.equal(f.status.textContent,'Submitted for review.');
  assert.equal(f.button.disabled,false);
});
