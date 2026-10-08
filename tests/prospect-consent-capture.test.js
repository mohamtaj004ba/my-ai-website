const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const contact=fs.readFileSync('contact.html','utf8');
const started=fs.readFileSync('get-started.html','utf8');
const contactApi=fs.readFileSync('api/contact.js','utf8');
const checkoutApi=fs.readFileSync('api/create-checkout-session.js','utf8');
const legacyLeadApi=fs.readFileSync('api/lead-create.js','utf8');
const privacy=fs.readFileSync('privacy.html','utf8');

test('public contact and checkout expose optional unchecked email-marketing consent controls',()=>{
  for(const page of [contact,started]){
    assert.match(page,/name="marketingEmailConsent" type="checkbox"/);
    assert.doesNotMatch(page,/name="marketingEmailConsent" type="checkbox"[^>]*required/);
    assert.match(page,/optional/i);
    assert.match(page,/unsubscribe anytime/i);
    assert.match(page,/href="\/privacy"/);
  }
  assert.match(contact,/not required to send this message/i);
  assert.match(started,/not required to purchase CallerCore/i);
});

test('browser payloads send explicit booleans rather than checkbox string values',()=>{
  assert.match(contact,/payload\.marketingEmailConsent=d\.get\('marketingEmailConsent'\)==='on'/);
  assert.match(started,/marketingEmailConsent:d\.get\('marketingEmailConsent'\)==='on'/);
});

test('server capture trusts only literal true and stamps a known first-party source',()=>{
  assert.match(contactApi,/req\.body\?\.marketingEmailConsent===true/);
  assert.match(contactApi,/marketingEmailConsent:\{granted:marketingEmailConsent,source:'contact_form'\}/);
  assert.match(contactApi,/\['Chatbot inquiry','Login help'\]\.includes\(category\)\?\{\}:\{marketingEmailConsent/);
  for(const api of [checkoutApi,legacyLeadApi]){
    assert.match(api,/marketingEmailConsent=raw\.marketingEmailConsent===true/);
    assert.match(api,/marketingEmailConsent:\{granted:marketingEmailConsent,source:'get_started'\}/);
  }
});

test('consent capture scope matches the published privacy promise and does not claim SMS opt-in',()=>{
  assert.match(privacy,/where you have opted in — marketing or follow-up messages/i);
  assert.match(privacy,/If you provide a phone number and opt in to text messages/i);
  for(const page of [contact,started]){
    assert.match(page,/Email me occasional CallerCore product news and offers/);
    assert.doesNotMatch(page,/text me|SMS marketing|marketing text/i);
  }
});
