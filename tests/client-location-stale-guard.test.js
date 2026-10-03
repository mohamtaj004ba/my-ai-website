const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const dashboard=fs.readFileSync('dashboard.js','utf8');

test('stale location IDs do not open an add-looking editor',()=>{
  const start=dashboard.indexOf('function openLocationModal(');
  const end=dashboard.indexOf('\nfunction closeLocationModal(',start);
  assert.ok(start>=0&&end>start);
  const block=dashboard.slice(start,end);
  assert.match(block,/if\(id&&!x\).*no longer available.*Refresh Locations.*return false/);
  assert.ok(block.indexOf('if(id&&!x)')<block.indexOf("classList.add('open')"));
});

test('stale location edits cannot report a no-op save as successful',()=>{
  const start=dashboard.indexOf('async function saveLocation(){');
  const end=dashboard.indexOf('\nasync function deleteLocation(',start);
  assert.ok(start>=0&&end>start);
  const block=dashboard.slice(start,end);
  assert.match(block,/if\(id&&!locationsData\.some\(x=>String\(x\.id\)===String\(id\)\)\).*no longer available.*return false/);
  assert.ok(block.indexOf('if(id&&!locationsData.some')<block.indexOf('persistLocations(next'));
});
