const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');

test('call history exposes high-volume controls',()=>{
  assert.match(html,/id="callsUnviewedCount" data-call-quick="unread"/);
  assert.match(html,/id="callDensity"/);
  assert.match(html,/id="callListFooter"/);
  assert.match(html,/id="callListMeta"/);
  assert.match(html,/id="loadMoreCalls"/);
});

test('call history progressively renders matching rows without losing filters',()=>{
  assert.match(js,/callVisibleLimit=50/);
  assert.match(js,/callLastFilterSignature=''/);
  assert.match(js,/if\(filterSignature!==callLastFilterSignature\)\{callLastFilterSignature=filterSignature;callVisibleLimit=50\}/);
  assert.match(js,/visibleRows=rows\.slice\(0,callVisibleLimit\)/);
  assert.match(js,/callVisibleLimit\+=50;renderCalls\(\)/);
  assert.match(js,/Showing '\+shown\+' of '\+totalRows\+' matching call/);
});

test('call history supports unopened filtering and persisted density',()=>{
  assert.match(js,/callQuickFilter==='unread'\?!callWasViewed\(x\.id\)/);
  assert.match(js,/unviewedCount=baseRows\.filter\(x=>!callWasViewed\(x\.id\)\)\.length/);
  assert.match(js,/density:callLogDensity/);
  assert.match(js,/call-density-compact/);
  assert.match(css,/\.call-history-panel\.call-density-compact \.call-row\.data/);
  assert.match(css,/button\[data-call-quick="unread"\]\.active/);
});
