const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

const src=fs.readFileSync(path.join(__dirname,'..','lib','mail.js'),'utf8');

test('Mailgun fallback uses the verified CallerCore sending domain',()=>{
  assert.match(src,/MAILGUN_DOMAIN\|\|'notify\.callercore\.com'/);
  assert.doesNotMatch(src,/MAILGUN_DOMAIN\|\|'mail\.callercore\.com'/);
});
