const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('dashboard.js','utf8');

test('client bootstrap validates the complete session identity before applying it',()=>{
  const start=source.indexOf('async function bootstrapClient()'),end=source.indexOf('\nasync function logout()',start);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  assert.match(body,/!data\.workspace\|\|typeof data\.workspace!=='object'/);
  assert.match(body,/!String\(data\.workspace\.id\|\|''\)/);
  assert.match(body,/!data\.user\|\|typeof data\.user!=='object'/);
  assert.match(body,/!String\(data\.user\.email\|\|''\)/);
  assert.match(body,/!data\.onboarding\|\|typeof data\.onboarding!=='object'/);
  assert.ok(body.indexOf("throw new Error('session payload')")<body.indexOf('sessionWorkspace=data.workspace'));
});
