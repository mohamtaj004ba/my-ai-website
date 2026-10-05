const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('dashboard.js','utf8');
test('phone refresh restores its matching action and falls back when the row is removed',()=>{
 let focused='';const replacement={disabled:false,getAttribute:()=> 'number-1',focus:()=>{focused='row'}},fallback={focus:()=>{focused='add'}};
 const ctx=vm.createContext({document:{getElementById:()=>fallback}});
 vm.runInContext(source.slice(source.indexOf('function restorePhoneRowFocus(')),ctx);
 ctx.wrap={querySelectorAll:()=>[replacement]};
 vm.runInContext("restorePhoneRowFocus({remove:'number-1'},wrap)",ctx);assert.equal(focused,'row');
 ctx.wrap={querySelectorAll:()=>[]};vm.runInContext("restorePhoneRowFocus({remove:'number-1'},wrap)",ctx);assert.equal(focused,'add');
 focused='composer';vm.runInContext('restorePhoneRowFocus(null,wrap)',ctx);assert.equal(focused,'composer');
});
test('leaving admin lists resets filters while preserving unsent work',()=>{
 const start=source.indexOf('function resetAdminViewFilters('),end=source.indexOf('function restorePhoneRowFocus(',start);
 const ctx=vm.createContext({adminClientFilter:'past',adminClientSearch:'roof',adminClientSort:'usage',adminSupportFilter:'closed',adminSupportSearch:'old',adminFeedbackFilter:'all',adminFeedbackSearch:'old',draft:'Unsent reply'});
 vm.runInContext(source.slice(start,end),ctx);vm.runInContext("resetAdminViewFilters('clients');resetAdminViewFilters('client-care')",ctx);
 assert.equal(ctx.adminClientFilter,'active');assert.equal(ctx.adminClientSearch,'');assert.equal(ctx.adminClientSort,'updated');assert.equal(ctx.adminSupportFilter,'active');assert.equal(ctx.adminSupportSearch,'');assert.equal(ctx.draft,'Unsent reply');
});
