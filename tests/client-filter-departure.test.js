const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const block=source.slice(source.indexOf('function resetClientViewFilters(view){'));
function fixture(){
 const controls=Object.fromEntries(['callSearch','callDateFilter','callCategoryFilter','callFilter','callDateFrom','callDateTo','callGroupBy','callSort','contactSearch','contactTypeFilter','contactSort','leadSearch','leadFilter'].map(id=>[id,{value:'custom'}]));
 const ctx=vm.createContext({document:{getElementById:id=>controls[id]},callLogGroupBy:'type',callLogSort:'oldest',callLogDensity:'compact',callQuickFilter:'unread',callMoreFiltersOpen:true,callVisibleLimit:100,callLastFilterSignature:'old',contactVisibleLimit:100,contactLastFilterSignature:'old',followupStatusFilter:'completed',showHandledFollowups:true,updateCustomDateVisibility(){}});
 vm.runInContext(block,ctx);return {controls,ctx,reset:view=>vm.runInContext(`resetClientViewFilters('${view}')`,ctx)};
}
test('departing the call page clears custom dates, search, quick filters and advanced presentation',()=>{
 const f=fixture();f.reset('calls');assert.equal(f.controls.callSearch.value,'');assert.equal(f.controls.callDateFilter.value,'7');assert.equal(f.controls.callDateFrom.value,'');assert.equal(f.controls.callSort.value,'newest');assert.equal(f.ctx.callQuickFilter,'all');assert.equal(f.ctx.callMoreFiltersOpen,false);assert.equal(f.ctx.callVisibleLimit,50);assert.equal(f.controls.contactSearch.value,'custom');
});
test('departing contacts resets its search, type, sort and pagination',()=>{
 const f=fixture();f.reset('contacts');assert.equal(f.controls.contactSearch.value,'');assert.equal(f.controls.contactTypeFilter.value,'all');assert.equal(f.controls.contactSort.value,'recent');assert.equal(f.ctx.contactVisibleLimit,50);assert.equal(f.controls.callSearch.value,'custom');
});
test('departing follow-ups returns to pending without closing a support draft',()=>{
 const f=fixture();f.controls.supportSubject={value:'My draft'};f.reset('leads');assert.equal(f.ctx.followupStatusFilter,'pending');assert.equal(f.ctx.showHandledFollowups,false);assert.equal(f.controls.leadFilter.value,'all');assert.equal(f.controls.supportSubject.value,'My draft');
});
test('background refresh preserves active advanced filters until the page is left',()=>{
 const f=fixture();const load=source.match(/function loadCallLogPrefs\(\)\{[^\n]+/)[0];vm.runInContext(load+'\nloadCallLogPrefs()',f.ctx);assert.equal(f.controls.callGroupBy.value,'type');assert.equal(f.controls.callSort.value,'oldest');f.reset('calls');vm.runInContext('loadCallLogPrefs()',f.ctx);assert.equal(f.controls.callGroupBy.value,'day');assert.equal(f.controls.callSort.value,'newest');
});
