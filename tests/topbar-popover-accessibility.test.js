const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync('dashboard.js','utf8');

test('topbar profile notifications and help popovers are mutually exclusive',()=>{
  const helper=js.slice(js.indexOf('function closeTopbarPopovers('),js.indexOf('\nfunction initProfileControls(',js.indexOf('function closeTopbarPopovers(')));
  assert.match(helper,/\['profile','accountPanel','accountButton'\]/);
  assert.match(helper,/\['notifications','notificationPanel','notificationBell'\]/);
  assert.match(helper,/\['help','helpPanel','helpButton'\]/);
  assert.match(helper,/button\.setAttribute\('aria-expanded','false'\)/);
  assert.match(js,/if\(opening\)closeTopbarPopovers\('profile'\)/);
  assert.match(js,/if\(opening\)closeTopbarPopovers\('notifications'\)/);
  assert.match(js,/if\(opening\)closeTopbarPopovers\('help'\)/);
});

test('opening Core Intelligence clears topbar popovers before taking focus',()=>{
  const block=js.slice(js.indexOf('function openAdminAiGuide('),js.indexOf('\nfunction closeAdminAiGuide(',js.indexOf('function openAdminAiGuide(')));
  assert.match(block,/closeTopbarPopovers\(\);panel\.classList\.add\('open'\)/);
});
