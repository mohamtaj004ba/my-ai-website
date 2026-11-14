const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const files=['api/chat.js','api/contact.js','api/create-checkout-session.js','api/demo-number.js','api/lead-create.js','api/onboarding-chat.js','api/prefill-crawl.js','api/reveal-token.js','api/site-track.js'];

test('preview API origins must match the request host',()=>{
  for(const name of files){
    const src=fs.readFileSync(path.join(root,name),'utf8');
    assert.match(src,/x-forwarded-host/,name+' must derive the actual request host');
    assert.match(src,/endsWith\('\.vercel\.app'\).*===requestHost/s,name+' must require same-host Vercel preview origin');
    assert.doesNotMatch(src,/ALLOWED_HOSTS\.has\([^)]*\)\s*\|\|\s*[^\n;]*endsWith\('\.vercel\.app'\)\s*[;)]/,name+' still broadly trusts any Vercel app');
  }
});
