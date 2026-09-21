const test=require('node:test');const assert=require('node:assert/strict');
const {AGREEMENT_VERSION,CLAUSES,planSnapshot,agreementSnapshot}=require('../api/_lib/agreement-clauses');
test('current agreement is versioned and populated',()=>{
  assert.equal(AGREEMENT_VERSION,'2.0');assert.ok(CLAUSES.length>=20);
  const snap=agreementSnapshot();assert.equal(snap.version,'2.0');assert.notEqual(snap.clauses,CLAUSES);
});
test('signed plan snapshots match current commercial terms',()=>{
  assert.deepEqual(planSnapshot('Starter'),{plan:'Starter',monthlyPrice:349,includedMinutes:'300',locations:'1 location'});
  assert.equal(planSnapshot('Pro').monthlyPrice,999);
});
