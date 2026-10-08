const test=require('node:test'),assert=require('node:assert/strict');
test('public feedback browser checks never forward either Preview credential to external assets or redirects',async()=>{
 const {feedbackRequestHeaders}=await import('../scripts/public-feedback-browser-qa.mjs');
 const origin='https://preview.vercel.app',headers={'x-vercel-protection-bypass':'fixture','x-qa-secret':'fixture','Accept':'text/html'};
 assert.deepEqual(feedbackRequestHeaders(origin+'/login',headers,origin),headers);
 for(const url of ['https://js.stripe.com/v3','https://fonts.googleapis.com/css','https://other.vercel.app/','http://preview.vercel.app/'])assert.deepEqual(feedbackRequestHeaders(url,headers,origin),{Accept:'text/html'});
 assert.equal(headers['x-qa-secret'],'fixture');
});
