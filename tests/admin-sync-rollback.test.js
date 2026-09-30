const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const dashboard=fs.readFileSync('dashboard.js','utf8');

test('admin Gmail unread state waits for provider confirmation and stale failures cannot double-count',()=>{
  const start=dashboard.indexOf('async function openInboxItem('),end=dashboard.indexOf('\nfunction inboxContactParts(',start),readFlow=dashboard.slice(start,end);
  assert.match(readFlow,/admin-gmail-read/);
  assert.match(readFlow,/if\(!r\.ok\)throw new Error\('Gmail read sync failed'\)/);
  assert.match(readFlow,/const current=\(adminInboxData\.gmail\?\.threads\|\|\[\]\)\.find/);
  assert.match(readFlow,/analytics\.unread=\(adminInboxData\.gmail\?\.threads\|\|\[\]\)\.filter/);
  assert.match(readFlow,/it remains unread/);
  assert.doesNotMatch(readFlow,/thread\.unread=false/);
});

test('client-care status selector reverts when server update fails',()=>{
  assert.match(dashboard,/async function updateSupportStatus\(id,status\)/);
  assert.match(dashboard,/const previous=t\.status/);
  assert.match(dashboard,/catch\(err\)\{t\.status=previous;alert/);
  assert.match(dashboard,/finally\{adminSupportStatusPending\.delete\(key\);renderAdminSupport\(\)\}/);
});
