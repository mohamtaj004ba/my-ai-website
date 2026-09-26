const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
const css=fs.readFileSync(path.join(root,'dashboard.css'),'utf8');

test('Follow-ups separates contact actions from workflow management',()=>{
  assert.match(js,/class="followup-contact-actions"/);
  assert.match(js,/class="followup-view-call" data-call-id=/);
  assert.match(js,/>View call →<\/button>/);
  assert.match(js,/class="followup-status-select"/);
  assert.match(css,/\.followup-actions\{\s*display:grid;\s*grid-template-columns:auto minmax\(132px,150px\)/);
  assert.match(css,/\.followup-status-select\{[\s\S]*border-left:1px solid #edf0f2;/);
});
