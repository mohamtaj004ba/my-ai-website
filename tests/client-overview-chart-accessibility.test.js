const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const dashboard=fs.readFileSync('dashboard.js','utf8');
const css=fs.readFileSync('dashboard.css','utf8');

test('Overview chart day drill-down is keyboard reachable and operable',()=>{
  assert.match(dashboard,/class="combo-hit" role="button" tabindex="0" aria-label="Open calls for /);
  assert.match(dashboard,/hit\?\.addEventListener\('click',openDay\)/);
  assert.match(dashboard,/hit\?\.addEventListener\('keydown',e=>\{if\(e\.key==='Enter'\|\|e\.key===' '\)\{e\.preventDefault\(\);openDay\(\)\}\}\)/);
  assert.match(css,/\.combo-hit:focus-visible\{stroke:currentColor;stroke-width:2;stroke-dasharray:4 3\}/);
});
