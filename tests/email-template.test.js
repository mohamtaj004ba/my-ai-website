const test=require('node:test');const assert=require('node:assert/strict');
const {lifecycleEmail,authEmail,stripHtml}=require('../lib/email-template');
test('lifecycle emails always expose support contact paths',()=>{
  const e=lifecycleEmail({title:'Test',bodyHtml:'<p>Hello</p>'});
  assert.match(e.html,/Questions or concerns/);assert.match(e.html,/support@callercore\.com/);assert.match(e.text,/support@callercore\.com/);
});
test('auth email supports CTA and polished HTML',()=>{
  const e=authEmail({title:'Sign in',ctaLabel:'Sign in',ctaUrl:'https://www.callercore.com/login'});
  assert.match(e.html,/CallerCore/);assert.match(e.html,/https:\/\/www\.callercore\.com\/login/);
});

test('plaintext conversion decodes each HTML entity only once',()=>{
  assert.equal(stripHtml('&amp;quot; &amp;amp; &quot; &#39;'),'&quot; &amp; " \'');
});
