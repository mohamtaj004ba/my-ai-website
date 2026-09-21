const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');

test('current customer-facing AI copy does not promise an unfinalized fixed overage rate',()=>{
  for(const name of ['api/chat.js','api/onboarding-chat.js']){
    const src=fs.readFileSync(path.join(root,name),'utf8');
    assert.doesNotMatch(src,/30 cents a minute|\$0\.30 per minute/i,name+' contains a fixed overage promise');
  }
});

test('current agreement v2 keeps overage pricing conditional on signup disclosure',()=>{
  const src=fs.readFileSync(path.join(root,'api','_lib','agreement-clauses.js'),'utf8');
  assert.match(src,/overage rate disclosed at signup/);
});
