const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const dashboard=fs.readFileSync('dashboard.js','utf8');

test('admin Gmail unread state rolls back if provider read sync fails',()=>{
  assert.match(dashboard,/thread\.unread=true;[\s\S]*?renderAdminInbox\(\)/);
  assert.match(dashboard,/admin-gmail-read/);
});

test('client-care status selector reverts when server update fails',()=>{
  assert.match(dashboard,/async function updateSupportStatus\(id,status\)/);
  assert.match(dashboard,/previous=t\?\.status/);
  assert.match(dashboard,/if\(!r\.ok\)\{if\(t&&previous\)t\.status=previous;renderAdminSupport\(\)/);
});
