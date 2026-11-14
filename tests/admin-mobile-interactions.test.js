const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('dashboard.js','utf8');
test('traffic chart recalculates geometry after its hidden section becomes visible',()=>{
 let callback,observed=0,writes=0,markup='';
 const shell={clientWidth:0,querySelectorAll:()=>[],set innerHTML(value){markup=value;writes++}};
 const ctx=vm.createContext({document:{getElementById:id=>id==='websiteTrafficChart'?shell:null},adminWebsiteData:{daily:[{date:'2026-10-05',sessions:12,visitors:8}]},ResizeObserver:class{constructor(fn){callback=fn}observe(){observed++}},esc:String,Date,Math,Number});
 const start=source.indexOf('function renderWebsiteTrafficChart('),end=source.indexOf("let adminWebsiteLoadError=",start);
 vm.runInContext(source.slice(start,end),ctx);vm.runInContext('renderWebsiteTrafficChart()',ctx);
 assert.match(markup,/viewBox="0 0 920 285"/);
 shell.clientWidth=432;callback();assert.match(markup,/viewBox="0 0 432 285"/);assert.equal(observed,1);
 const prior=writes;callback();assert.equal(writes,prior);
 shell.clientWidth=0;callback();assert.equal(writes,prior);
});
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
 const phoneNodes={phoneSearch:{value:'555'},phoneAssignmentFilter:{value:'assigned'}};
 const ctx=vm.createContext({adminClientFilter:'past',adminClientSearch:'roof',adminClientSort:'usage',adminSupportFilter:'closed',adminSupportSearch:'old',adminFeedbackFilter:'all',adminFeedbackSearch:'old',draft:'Unsent reply',document:{getElementById:id=>phoneNodes[id]},phoneVisibleLimit:100,phoneFilterSignature:'custom',adminInboxData:{filter:'gmail',search:'custom'}});
 vm.runInContext(source.slice(start,end),ctx);vm.runInContext("resetAdminViewFilters('clients');resetAdminViewFilters('client-care')",ctx);
 assert.equal(ctx.adminClientFilter,'active');assert.equal(ctx.adminClientSearch,'');assert.equal(ctx.adminClientSort,'updated');assert.equal(ctx.adminSupportFilter,'active');assert.equal(ctx.adminSupportSearch,'');assert.equal(ctx.draft,'Unsent reply');
 vm.runInContext("resetAdminViewFilters('phones');resetAdminViewFilters('inbox')",ctx);
 assert.equal(phoneNodes.phoneSearch.value,'');assert.equal(phoneNodes.phoneAssignmentFilter.value,'all');assert.equal(ctx.phoneVisibleLimit,50);assert.equal(ctx.adminInboxData.filter,'all');assert.equal(ctx.adminInboxData.search,'');assert.equal(ctx.draft,'Unsent reply');
});
