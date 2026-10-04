const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('dashboard.js','utf8');
test('admin read-only sticky offset follows the real banner height after wrapping or resizing',()=>{
  const values=[],context=vm.createContext({document:{documentElement:{style:{setProperty:(name,value)=>values.push([name,value])}}}});
  vm.runInContext(js.slice(js.indexOf('function syncAdminViewOffset('),js.indexOf('function displayAnalyticsLocation(')),context);
  for(const height of [53.2,94.6,40])context.syncAdminViewOffset({getBoundingClientRect:()=>({height})});
  assert.deepEqual(values,[['--admin-view-offset','54px'],['--admin-view-offset','95px'],['--admin-view-offset','40px']]);
});
test('analytics locations decode provider-encoded spaces and unicode while malformed percent sequences remain readable',()=>{
  const context=vm.createContext({});
  vm.runInContext(js.slice(js.indexOf('function displayAnalyticsLocation('),js.indexOf('function conversationActivity(')),context);
  assert.equal(context.displayAnalyticsLocation('San%20Jose'),'San Jose');
  assert.equal(context.displayAnalyticsLocation('S%C3%A3o%20Paulo'),'São Paulo');
  assert.equal(context.displayAnalyticsLocation('100% local'),'100% local');
  assert.equal(context.displayAnalyticsLocation('San%2520Jose'),'San%20Jose','decode once rather than recursively interpreting stored data');
});
