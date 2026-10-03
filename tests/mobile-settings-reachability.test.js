const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('mobile Settings edit mode keeps save actions reachable above the safe area',()=>{
  const js=fs.readFileSync('dashboard.js','utf8'),css=fs.readFileSync('dashboard.css','utf8');
  const start=js.indexOf('function setSettingsEditing('),end=js.indexOf('\nfunction renderAiAnsweringControl(',start),block=js.slice(start,end);
  assert.match(block,/view\?\.classList\.toggle\('settings-editing',settingsEditing\)/);
  assert.match(css,/#view-settings\.settings-editing\{padding-bottom:112px\}/);
  assert.match(css,/#view-settings\.settings-editing \.page-head>\.page-actions\{[\s\S]*position:fixed;[\s\S]*bottom:max\(12px,env\(safe-area-inset-bottom\)\)/);
  assert.match(css,/#view-settings\.settings-editing \.page-head>\.page-actions #saveSettingsButton\{[\s\S]*min-height:42px/);
});
