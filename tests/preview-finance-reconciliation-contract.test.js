const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('scripts/preview-browser-qa.mjs','utf8');
test('authenticated Preview QA exercises the read-only Finance payment exception contract',()=>{
  assert.match(source,/admin-finance'\)/);
  assert.match(source,/Array\.isArray\(financePayload\?\.reconciliation\)/);
  assert.match(source,/window\.__qaOriginalFinanceData=adminFinanceData/);
  assert.match(source,/type==='checkout-reconciliation'/);
  assert.match(source,/#financeReconciliationStatus/);
  assert.match(source,/delete window\.__qaOriginalFinanceData/);
  assert.match(source,/read-only checkout reconciliation \+ priority alert \+ stale Finance disclosure/);
});
