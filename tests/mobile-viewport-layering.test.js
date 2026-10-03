const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('mobile shell and drawers use dynamic viewport units without legacy viewport dependency',()=>{
  const css=fs.readFileSync('dashboard.css','utf8');
  assert.match(css,/\.app-shell\{min-height:100dvh/);
  assert.doesNotMatch(css,/\.app-shell\{min-height:100vh/);
  assert.match(css,/\.call-drawer\{[^}]*height:100dvh/);
  assert.doesNotMatch(css,/\.call-drawer\{[^}]*height:100vh/);
});

test('persistent sync health stays below modal and drawer interaction layers',()=>{
  const css=fs.readFileSync('dashboard.css','utf8');
  const toast=Number((css.match(/\.client-sync-toast\{[^}]*z-index:(\d+)/)||[])[1]);
  const modal=Number((css.match(/\.modal\{[^}]*z-index:(\d+)/)||[])[1]);
  const backdrop=Number((css.match(/\.drawer-backdrop\{[^}]*z-index:(\d+)/)||[])[1]);
  const settings=Number((css.match(/#view-settings\.settings-editing \.page-head>\.page-actions\{[\s\S]*?z-index:(\d+)/)||[])[1]);
  assert.ok(Number.isFinite(toast)&&Number.isFinite(settings)&&Number.isFinite(modal)&&Number.isFinite(backdrop));
  assert.ok(toast<settings);
  assert.ok(settings<modal);
  assert.ok(modal<backdrop);
});

test('phone topbar controls keep deliberate 40px interaction targets',()=>{
  const css=fs.readFileSync('dashboard.css','utf8');
  assert.match(css,/\.mobile-menu\{display:inline-grid;[^}]*width:40px;height:40px/);
  assert.match(css,/body\[data-dashboard="admin"\] \.admin-ai-launch\{width:40px;height:40px;flex:0 0 40px\}/);
  assert.match(css,/body\[data-dashboard="admin"\] \.admin-search-shell \.admin-search\{width:40px;height:40px\}/);
  assert.match(css,/body\[data-dashboard="admin"\] \.notification-bell\{width:40px;height:40px;flex:0 0 40px\}/);
  assert.match(css,/body\[data-dashboard="admin"\] \.account-button\{[\s\S]*?width:40px;[\s\S]*?height:40px;/);
});
