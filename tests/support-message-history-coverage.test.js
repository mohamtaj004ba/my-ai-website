const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const css=fs.readFileSync('dashboard.css','utf8');

test('client and admin Support threads visibly disclose retained-message limits',()=>{
  assert.match(dashboard,/support-history-warning/);
  assert.match(dashboard,/Showing the most recent/);
  assert.match(dashboard,/Older support messages may not be available in CallerCore/);
  assert.match(css,/\.support-history-warning/);
});
test('global admin search discloses that truncated Support threads do not provide full historic message search',()=>{
  assert.match(dashboard,/Some Support searches cover only retained recent messages/);
});
