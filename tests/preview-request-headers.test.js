const test=require('node:test'),assert=require('node:assert/strict');
test('Preview access headers remain scoped to the exact authenticated deployment',async()=>{
  const {previewRequestHeaders}=await import('../scripts/preview-request-headers.mjs');
  const origin='https://caller-preview.vercel.app',headers={'x-vercel-protection-bypass':'fixture-secret','X-Vercel-Set-Bypass-Cookie':'true',accept:'application/json'};
  assert.deepEqual(previewRequestHeaders(origin+'/api/account',headers,origin),headers);
  for(const url of ['https://m.stripe.com/6','https://m.stripe.network/','https://caller-preview.vercel.app.evil.test/','http://caller-preview.vercel.app/']){
    assert.deepEqual(previewRequestHeaders(url,headers,origin),{accept:'application/json'});
  }
  assert.equal(headers['x-vercel-protection-bypass'],'fixture-secret');
});
