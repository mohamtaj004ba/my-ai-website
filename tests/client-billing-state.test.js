const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('dashboard.html','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');

test('client billing status is driven by live subscription state',()=>{
  assert.match(html,/id="billingSubscriptionStatus"/);
  assert.match(dashboard,/subscription==='past_due'\?\{label:'Past due',tone:'red'\}/);
  assert.match(dashboard,/statusTag\.className='tag '\+statusMeta\.tone/);
  assert.match(dashboard,/Payment needs attention/);
});
