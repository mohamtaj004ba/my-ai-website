const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('modal-accessibility.js','utf8');

test('dialog keyboard loop excludes controls that are not actually rendered',()=>{
  assert.match(source,/function isRendered\(element\)/);
  assert.match(source,/closest\('\[hidden\],\[aria-hidden="true"\]'\)/);
  assert.match(source,/ownerDocument\?\.defaultView\|\|globalThis/);
  assert.match(source,/getComputedStyle\(element\)/);
  assert.match(source,/style\.display!=='none'/);
  assert.match(source,/style\.visibility!=='hidden'/);
  assert.match(source,/getClientRects\(\)\.length>0/);
  assert.match(source,/querySelectorAll\(selector\)\]\.filter\(isRendered\)/);
});

test('dialog focus loop excludes disabled and explicitly untabbable actions',()=>{
  assert.match(source,/a\[href\]:not\(\[tabindex="-1"\]\):not\(\[aria-disabled="true"\]\)/);
  assert.match(source,/getAttribute\?\.\('aria-disabled'\)==='true'/);
});

test('dialog focus return refuses disabled or hidden opener controls',()=>{
  assert.match(source,/!target\.hasAttribute\?\.\('disabled'\)/);
  assert.match(source,/isRendered\(target\)/);
});

test('dialog-to-dialog transitions inherit the original launcher for focus return',()=>{
  assert.match(source,/const dialogs=\[\.\.\.document\.querySelectorAll/);
  assert.match(source,/if\(!state\.returnFocus\)state\.returnFocus=/);
  assert.match(source,/const successor=dialogs\.find\(other=>other!==modal&&isOpen\(other\)\)/);
  assert.match(source,/!successorState\.returnFocus\|\|modal\.contains\(successorState\.returnFocus\)/);
  assert.match(source,/successorState\.returnFocus=target;state\.returnFocus=null;return/);
});

