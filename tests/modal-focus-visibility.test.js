const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('modal-accessibility.js','utf8');

test('dialog keyboard loop excludes controls that are not actually rendered',()=>{
  assert.match(source,/function isRendered\(element\)/);
  assert.match(source,/closest\('\[hidden\],\[aria-hidden="true"\]'\)/);
  assert.match(source,/getComputedStyle\(element\)/);
  assert.match(source,/style\.display!=='none'/);
  assert.match(source,/style\.visibility!=='hidden'/);
  assert.match(source,/getClientRects\(\)\.length>0/);
  assert.match(source,/querySelectorAll\(selector\)\]\.filter\(isRendered\)/);
});

test('dialog focus return refuses disabled or hidden opener controls',()=>{
  assert.match(source,/!target\.hasAttribute\?\.\('disabled'\)/);
  assert.match(source,/isRendered\(target\)/);
});
