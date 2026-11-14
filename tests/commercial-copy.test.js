const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');

test('current customer-facing AI copy does not promise an unfinalized fixed overage rate',()=>{
  for(const name of ['api/chat.js','api/onboarding-chat.js']){
    const src=fs.readFileSync(path.join(root,name),'utf8');
    assert.doesNotMatch(src,/30 cents a minute|\$0\.30 per minute/i,name+' contains a fixed overage promise');
  }
});

test('current agreement keeps overage pricing conditional on explicit customer acceptance',()=>{
  const src=fs.readFileSync(path.join(root,'api','_lib','agreement-clauses.js'),'utf8');
  const current=src.slice(src.indexOf('const CLAUSES ='));
  assert.match(current,/will not incur an automatic overage fee unless an overage rate or other usage charge was disclosed/);
  assert.match(current,/will not automatically charge an overage fee/);
  assert.doesNotMatch(current,/includedMinutes:'Unlimited'/i);
});

test('default checkout never silently attaches the dormant metered overage price',()=>{
  const src=fs.readFileSync(path.join(root,'api','create-checkout-session.js'),'utf8');
  assert.match(src,/line_items\[0\]\[price\]/);
  assert.match(src,/line_items\[1\]\[price\]/);
  assert.doesNotMatch(src,/line_items\[2\]/);
  assert.doesNotMatch(src,/price_1To9SUF0BXlPng7VMlDTJE8P/);
  assert.doesNotMatch(src,/OVERAGE_PRICE/);
});
