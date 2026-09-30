const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('follow-up read rejects malformed state instead of returning fake empty history',async()=>{
  const start=api.indexOf('async function followups('),end=api.indexOf('\nasync function followupUpdate(',start);
  let status=0,payload;
  const ctx=vm.createContext({requireSession:async()=>({workspaceId:'client'}),kv:{get:async()=>['bad']},req:{},res:{status(n){status=n;return this},json(x){payload=x;return x}},Array});
  vm.runInContext(api.slice(start,end),ctx);await vm.runInContext('followups(req,res)',ctx);
  assert.equal(status,503);assert.match(payload.error,/preserved/);
});

test('follow-up note mutation refuses a 101st note instead of silently dropping the oldest',()=>{
  const start=api.indexOf('async function followupUpdate('),end=api.indexOf('\nasync function ',start+1),block=api.slice(start,end);
  assert.match(block,/notes\.length>=100/);
  assert.match(block,/100-note history limit/);
  assert.doesNotMatch(block,/notes=notes\.slice\(-100\)/);
  assert.doesNotMatch(block,/previous\.notes\?previous\.notes\.slice\(-100\)/);
});

test('call drawer disables add-note action at the retained note boundary',()=>{
  assert.match(dashboard,/atLimit=notes\.length>=100/);
  assert.match(dashboard,/toggle\.disabled=atLimit/);
  assert.match(dashboard,/older notes may have been removed by prior history limits/);
});

test('follow-up refresh preserves last-good state on malformed or failed response',()=>{
  const start=dashboard.indexOf('async function loadFollowupState('),end=dashboard.indexOf('\nfunction followupIsHandled',start),block=dashboard.slice(start,end);
  assert.match(block,/preserving last good state/);
  assert.doesNotMatch(block,/catch[^}]*followupState=\{\}/);
});
