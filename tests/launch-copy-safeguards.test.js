const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const chat=fs.readFileSync(path.join(root,'api','chat.js'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');

test('public launch copy does not promise unlaunched SMS or calendar booking',()=>{
  assert.doesNotMatch(index,/books appointments/i);
  assert.doesNotMatch(index,/appointment scheduling/i);
  assert.doesNotMatch(chat,/automatic follow-up text the moment the call ends/i);
  assert.doesNotMatch(chat,/appointment booking, SMS marketing/i);
  assert.match(chat,/Do not promise SMS, calendar booking, or any integration unless it is explicitly enabled/);
});

test('admin deletion copy reflects recoverable deletion instead of immediate destruction',()=>{
  assert.match(dashboard,/30-day recovery period/);
  assert.doesNotMatch(dashboard,/This permanently removes its CallerCore workspace data\. This cannot be undone/);
});
