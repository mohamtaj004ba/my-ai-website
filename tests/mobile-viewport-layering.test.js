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
  assert.ok(Number.isFinite(toast)&&Number.isFinite(modal)&&Number.isFinite(backdrop));
  assert.ok(toast<modal);
  assert.ok(toast<backdrop);
});
