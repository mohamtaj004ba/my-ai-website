const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const dashboard=fs.readFileSync('dashboard.js','utf8');
const account=fs.readFileSync('api/account.js','utf8');
const gmail=fs.readFileSync('lib/gmail.js','utf8');

test('Gmail inbox records bounded coverage and stale HTTP 200 fallback remains visibly stale',()=>{
  assert.match(gmail,/coverage=\{verified:true,limited:!!list\.nextPageToken/);
  assert.match(gmail,/estimatedThreads/);
  assert.match(account,/coverage:\{verified:false,limited:false,loadedThreads:0,estimatedThreads:null,queryWindow:'30d'\}/);
  assert.match(dashboard,/adminInboxData\.liveError=String\(d\.warning\|\|\(d\.stale===true\?'Gmail refresh failed':''\)\)/);
  assert.match(dashboard,/Gmail search coverage is not verified yet/);
  assert.match(dashboard,/Only '\+loaded/);
});

test('Client Care APIs report missing indexed records instead of silently presenting complete coverage',()=>{
  assert.match(account,/adminSupport[\s\S]*missingRecords\+\+/);
  assert.match(account,/tickets,coverage:\{verified:true,indexedRecords:index\.length,loadedRecords:tickets\.length,missingRecords,incomplete:missingRecords>0\}/);
  assert.match(account,/feedback:items,coverage:\{verified:true,indexedRecords:ids\.length,loadedRecords:items\.length,missingRecords,incomplete:missingRecords>0\}/);
  assert.match(dashboard,/counts and search results may be partial/);
});

test('global search discloses result caps and source coverage',()=>{
  const start=dashboard.indexOf('function adminSearchScore(');
  const end=dashboard.indexOf('\nasync function loadAdminSearchInboxCache(',start);
  assert.ok(start>=0&&end>start);
  const ctx=vm.createContext({
    adminClientsData:Array.from({length:60},(_,i)=>({id:'client-'+i,name:'Needle Client '+i,ownerEmail:'needle'+i+'@example.test'})),
    adminProvisioningData:[],adminFleetData:{agents:[],automations:[]},adminPhoneData:[],
    adminWebsiteData:{prospects:[],topPages:[],sources:[]},adminCampaignData:[],adminSupportData:[],adminFeedbackData:[],
    adminFinanceData:{expenses:[]},adminDocumentsData:{agreements:[],company:[],standard:[]},adminHealthData:[],
    adminReadinessData:{blockers:[]},adminInboxData:{gmailStatus:{connected:false},gmail:{threads:[]}},
    adminSupportCoverage:{verified:true},adminFeedbackCoverage:{verified:true},adminDataSyncAt:{},
    financeMoney:()=>'',String,Array,Math,Date
  });
  vm.runInContext(dashboard.slice(start,end),ctx);
  ctx.query='needle';
  const results=vm.runInContext('adminGlobalSearchItems(query)',ctx);
  assert.equal(results.length,48);
  assert.equal(results.totalMatches,60);
  assert.equal(results.limited,true);
});

test('global Client Care search results clear filters before revealing exact support or feedback target',()=>{
  assert.match(dashboard,/if\(type==='support'\)\{adminSupportSearch='';adminSupportFilter='all';openClientCare\('support'\);renderAdminSupport\(\)\}/);
  assert.match(dashboard,/else if\(type==='feedback'\)\{adminFeedbackSearch='';adminFeedbackFilter='all';openClientCare\('feedback'\);renderAdminFeedback\(\)\}/);
});


test('client and admin retry controls lock while their refresh is pending and always restore',()=>{
  assert.match(dashboard,/async function runRetryButton\(button,busyLabel,task\)/);
  assert.match(dashboard,/if\(!button\|\|button\.disabled\)return false/);
  assert.match(dashboard,/button\.disabled=true;button\.textContent=busyLabel/);
  assert.match(dashboard,/finally\{button\.disabled=false;button\.textContent=prior\}/);
  assert.match(dashboard,/clientDataRetry'\)\?\.addEventListener\('click',e=>runRetryButton/);
  assert.match(dashboard,/clientSecondaryRetry'\)\?\.addEventListener\('click',e=>runRetryButton/);
  assert.match(dashboard,/adminDataRetry'\)\?\.addEventListener\('click',e=>runRetryButton/);
});
