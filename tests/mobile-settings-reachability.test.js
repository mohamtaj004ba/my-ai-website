const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('mobile Settings section footer keeps actions reachable above the safe area and below dialogs',()=>{
 const css=fs.readFileSync('dashboard.css','utf8');
 const footer=css.match(/\.settings-card\.editing \.settings-section-actions\{position:fixed;([^}]+)\}/);
 assert.ok(footer);assert.match(footer[1],/bottom:max\(12px,env\(safe-area-inset-bottom\)\)/);
 const z=Number(footer[1].match(/z-index:(\d+)/)[1]);
 assert.ok(z<Number(css.match(/\.modal\{[^}]*z-index:(\d+)/)[1]));
 assert.ok(z<Number(css.match(/\.call-drawer\{[^}]*z-index:(\d+)/)[1]));
 assert.match(css,/\.settings-section-actions #settingsCancelButton\{min-height:42px/);
});
