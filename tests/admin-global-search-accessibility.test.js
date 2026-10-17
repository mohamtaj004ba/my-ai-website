const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('admin global search exposes a complete combobox/listbox accessibility contract',()=>{
  const html=fs.readFileSync('admin-dashboard.html','utf8');
  const input=(html.match(/<input id="adminSearch"[^>]*>/)||[])[0]||'';
  assert.match(input,/role="combobox"/);
  assert.match(input,/aria-autocomplete="list"/);
  assert.match(input,/aria-haspopup="listbox"/);
  assert.match(input,/aria-expanded="false"/);
  assert.match(input,/aria-controls="adminSearchResults"/);
  assert.match(html,/id="adminSearchResults" role="listbox"/);
});
