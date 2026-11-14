const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

test('client notification coverage marks missing support and feedback records unavailable',()=>{
  const start=api.indexOf('async function buildClientNotifications('),end=api.indexOf('\nasync function buildAdminNotifications(',start),block=api.slice(start,end);
  assert.match(block,/supportRecordUnavailable=true/);
  assert.match(block,/feedbackRecordUnavailable=/);
  assert.match(block,/supportRecordUnavailable\)sources\.push\('support_unavailable'\)/);
  assert.match(block,/feedbackRecordUnavailable\)sources\.push\('ai_feedback_unavailable'\)/);
});
