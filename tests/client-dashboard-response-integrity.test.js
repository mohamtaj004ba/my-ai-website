const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');

function block(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,start+' must exist');
  return source.slice(a,b);
}
const code=block('function clientPayloadRecord(',"\nfunction setClientSyncState(");

function validPayload(){
  return {
    workspace:{id:'ws-1',plan:'Growth'},calls:[],leads:[],agent:{name:'Maya'},settings:{businessName:'Test'},
    integrations:{},routing:null,locations:[],locationsLimit:1,conversations:[],
    conversationPage:{conversations:[],total:0,nextCursor:null},appointments:[],automations:[],onboarding:null,
    followupState:{},followupCoverage:{verified:true},viewedCallIds:[],viewedCallCoverage:{verified:true,limited:false,retained:0,limit:2000}
  };
}

test('bundled client dashboard payload validation rejects missing or malformed source families before mutation',()=>{
  const ctx=vm.createContext({
    callsData:[{id:'old-call'}],leadsData:[{id:'old-lead'}],agentData:{name:'Old'},settingsData:{businessName:'Old'},
    integrationsData:{old:true},phoneRoutingData:{number:'old'},locationsData:[{id:'old-location'}],locationsLimit:3,
    conversationsData:[{id:'old-conversation'}],appointmentsData:[{id:'old-appt'}],automationsData:[{id:'old-auto'}],
    Array,Object,String,Number,Error
  });
  vm.runInContext(code,ctx);
  assert.throws(()=>vm.runInContext("applyClientDashboardData({workspace:{id:'ws-1'}})",ctx),/incomplete/);
  assert.equal(ctx.callsData[0].id,'old-call');
  assert.equal(ctx.settingsData.businessName,'Old');
  assert.equal(ctx.locationsData[0].id,'old-location');
});

test('bundled validator accepts the complete server response contract and rejects invalid nullable records',()=>{
  const ctx=vm.createContext({Array,Object,String,Number,Error,payload:validPayload()});
  const validator=block('function clientPayloadRecord(',"\nfunction applyClientFallbackPayload(");
  vm.runInContext(validator,ctx);
  assert.equal(vm.runInContext('assertClientDashboardPayload(payload)===payload',ctx),true);
  ctx.payload={...validPayload(),routing:[]};
  assert.throws(()=>vm.runInContext('assertClientDashboardPayload(payload)',ctx),/incomplete/);
  ctx.payload={...validPayload(),conversationPage:{conversations:null}};
  assert.throws(()=>vm.runInContext('assertClientDashboardPayload(payload)',ctx),/incomplete/);
});

test('fallback client feeds preserve last verified values when an HTTP 200 payload is incomplete',()=>{
  const ctx=vm.createContext({
    callsData:[{id:'old-call'}],leadsData:[{id:'old-lead'}],agentData:{name:'Old'},settingsData:{businessName:'Old'},
    integrationsData:{old:true},phoneRoutingData:{number:'old'},locationsData:[{id:'old-location'}],locationsLimit:3,
    Array,Object,String,Number,Error
  });
  const helpers=block('function clientPayloadRecord(',"\nfunction applyClientDashboardData(");
  vm.runInContext(helpers,ctx);
  assert.equal(vm.runInContext("applyClientFallbackPayload('calls',{calls:null})",ctx),false);
  assert.equal(ctx.callsData[0].id,'old-call');
  assert.equal(vm.runInContext("applyClientFallbackPayload('settings',{settings:null})",ctx),false);
  assert.equal(ctx.settingsData.businessName,'Old');
  assert.equal(vm.runInContext("applyClientFallbackPayload('locations',{locations:[],limit:'bad'})",ctx),false);
  assert.equal(ctx.locationsData[0].id,'old-location');
  assert.equal(ctx.locationsLimit,3);
  ctx.good={locations:[{id:'new-location'}],limit:2};
  assert.equal(vm.runInContext("applyClientFallbackPayload('locations',good)",ctx),true);
  assert.equal(ctx.locationsData[0].id,'new-location');
  assert.equal(ctx.locationsLimit,2);
});
