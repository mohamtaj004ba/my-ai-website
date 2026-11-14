const test=require('node:test');const assert=require('node:assert/strict');
const {addBusinessHours,localParts}=require('../lib/business-hours');
function iso(ms){return new Date(ms).toISOString()}
test('adds two business hours inside the same workday',()=>{
  const start=Date.parse('2026-09-22T20:00:00Z'); // 1:00 PM PDT Tue
  assert.equal(iso(addBusinessHours(start,2)),'2026-09-22T22:00:00.000Z');
});
test('rolls review time across the weekend',()=>{
  const start=Date.parse('2026-09-25T23:00:00Z'); // 4:00 PM PDT Fri
  assert.equal(iso(addBusinessHours(start,2)),'2026-09-28T17:00:00.000Z'); // Mon 10 AM PDT
});
test('starts overnight requests at next business open',()=>{
  const start=Date.parse('2026-09-22T09:00:00Z'); // 2:00 AM PDT Tue
  assert.equal(iso(addBusinessHours(start,2)),'2026-09-22T18:00:00.000Z'); // 11 AM PDT
});
test('localParts uses Pacific business timezone',()=>{
  const p=localParts(new Date('2026-09-22T16:00:00Z'));
  assert.equal(p.hour,'09');
});
