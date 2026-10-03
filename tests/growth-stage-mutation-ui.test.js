const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Growth stage mutation requires canonical prospect identity, stage, and revision',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const start=ui.indexOf('async function moveGrowthProspectStage(id,bucket){');
  const end=ui.indexOf('\nfunction toLocalDateTimeInput(',start);
  assert.ok(start>=0&&end>start);
  const fn=ui.slice(start,end);
  assert.match(fn,/prospectStagePending\.has\(key\)/);
  assert.match(fn,/data\.ok!==true/);
  assert.match(fn,/String\(data\.prospect\.id\)!==key/);
  assert.match(fn,/String\(data\.prospect\.stage\)!==stage/);
  assert.match(fn,/Number\.isFinite\(Number\(data\.prospect\.updatedAt\)\)/);
  assert.match(fn,/Number\(data\.prospect\.updatedAt\)<=expectedUpdatedAt/);
  assert.match(fn,/if\(current&&Number\(current\.updatedAt\|\|current\.createdAt\|\|0\)<=Number\(data\.prospect\.updatedAt\|\|0\)\)Object\.assign\(current,data\.prospect\)/);
});

test('legacy weak updateWebsiteProspect mutation helper is removed',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  assert.doesNotMatch(ui,/async function updateWebsiteProspect\(/);
});


test('Growth stage mutation reports progress and failures inline',()=>{
  const ui=fs.readFileSync('dashboard.js','utf8');
  const html=fs.readFileSync('admin-dashboard.html','utf8');
  const start=ui.indexOf('async function moveGrowthProspectStage(id,bucket){');
  const end=ui.indexOf('\nfunction toLocalDateTimeInput(',start);
  const fn=ui.slice(start,end);
  assert.match(html,/id="growthActionStatus" class="muted" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(fn,/actionStatus\.textContent='Moving prospect…'/);
  assert.match(fn,/actionStatus\.textContent='Prospect moved to '/);
  assert.match(fn,/actionStatus\.className='muted error-text'/);
  assert.doesNotMatch(fn,/alert\(/);
});
