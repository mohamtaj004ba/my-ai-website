const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');

test('shared limiter supports fail-closed behavior',()=>{
  const src=fs.readFileSync(path.join(root,'lib','rate-limit.js'),'utf8');
  assert.match(src,/failClosed=false/);
  assert.match(src,/limited:!!failClosed/);
  assert.match(src,/unavailable:!!failClosed/);
});

test('sensitive public endpoints fail closed when rate-limit storage is unavailable',()=>{
  for(const name of ['api/chat.js','api/contact.js','api/create-checkout-session.js','api/demo-number.js','api/lead-create.js','api/onboarding-chat.js','api/prefill-crawl.js','api/reveal-token.js']){
    const src=fs.readFileSync(path.join(root,name),'utf8');
    assert.match(src,/rateLimit\(\{[\s\S]*?failClosed:true\}\)/,name+' must fail closed');
  }
});
