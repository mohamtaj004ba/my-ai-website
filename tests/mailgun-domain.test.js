const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const src=fs.readFileSync(path.join(__dirname,'..','lib','mail.js'),'utf8');

test('Mailgun fallback uses the verified CallerCore sending domain',()=>{
  assert.match(src,/MAILGUN_DOMAIN\|\|'notify\.callercore\.com'/);
  assert.doesNotMatch(src,/MAILGUN_DOMAIN\|\|'mail\.callercore\.com'/);
});


test('attachment Mailgun helper uses the verified sending domain and verifies provider receipts',()=>{
  const attachmentMail=fs.readFileSync(path.join(__dirname,'..','api','_lib','mailgun.js'),'utf8');
  assert.match(attachmentMail,/MAILGUN_DOMAIN\s*=\s*process\.env\.MAILGUN_DOMAIN\s*\|\|\s*'notify\.callercore\.com'/);
  assert.doesNotMatch(attachmentMail,/MAILGUN_DOMAIN\s*=\s*process\.env\.MAILGUN_DOMAIN\s*\|\|\s*'mail\.callercore\.com'/);
  assert.match(attachmentMail,/if\(!MAILGUN_API_KEY\)return reject\(new Error\('MAILGUN_API_KEY missing'\)\)/);
  assert.match(attachmentMail,/Mailgun delivery receipt could not be verified/);
  assert.match(attachmentMail,/!String\(receipt\.id\|\|''\)/);
});
