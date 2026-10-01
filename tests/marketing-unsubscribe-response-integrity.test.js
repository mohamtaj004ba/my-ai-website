const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const page=fs.readFileSync('unsubscribe.html','utf8');
const api=fs.readFileSync('api/marketing-unsubscribe.js','utf8');

test('unsubscribe inspection only enables mutation after a canonical active-state response',()=>{
  assert.match(page,/response\.json\(\)\.catch\(\(\)=>null\)/);
  assert.match(page,/body\.ok!==true\|\|typeof body\.active!=='boolean'\|\|typeof body\.alreadyUnsubscribed!=='boolean'/);
  assert.match(page,/if\(body\.active!==true\)throw new Error\('This unsubscribe link is no longer active\.'/);
});

test('unsubscribe success requires a canonical saved preference acknowledgement',()=>{
  assert.match(page,/body\.ok!==true\|\|body\.unsubscribed!==true\|\|typeof body\.alreadyUnsubscribed!=='boolean'/);
  assert.match(page,/We could not verify your email preference change/);
  assert.match(api,/res\.status\(200\)\.json\(\{ok:true,unsubscribed:true,alreadyUnsubscribed:result\.alreadyUnsubscribed===true\}\)/);
});
