const test=require('node:test');const assert=require('node:assert/strict');
const {AGREEMENT_VERSION,CLAUSES,planSnapshot,agreementSnapshot}=require('../api/_lib/agreement-clauses');
test('current agreement is versioned and populated',()=>{
  assert.equal(AGREEMENT_VERSION,'2.1');assert.ok(CLAUSES.length>=20);
  const snap=agreementSnapshot();assert.equal(snap.version,'2.1');assert.notEqual(snap.clauses,CLAUSES);
});
test('signed plan snapshots match current commercial terms',()=>{
  assert.deepEqual(planSnapshot('Starter'),{plan:'Starter',monthlyPrice:349,includedMinutes:'300',locations:'1 location'});
  assert.equal(planSnapshot('Pro').monthlyPrice,999);
});

test('current Pro agreement snapshot does not grant unlimited usage',()=>{
  const pro=planSnapshot('Pro');
  assert.equal(pro.monthlyPrice,999);
  assert.equal(pro.includedMinutes,'');
  assert.match(pro.usageNote,/High-volume plan/);
  assert.doesNotMatch(JSON.stringify(pro),/Unlimited/i);
});

test('current agreement requires accepted usage terms before automatic overage charges',()=>{
  const fees=CLAUSES.find(([title])=>title.startsWith('4. '));
  assert.ok(fees);
  assert.match(fees[1],/will not incur an automatic overage fee unless an overage rate or other usage charge was disclosed/);
  assert.match(fees[1],/will not automatically charge an overage fee/);
});
