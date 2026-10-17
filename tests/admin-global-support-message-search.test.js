const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('function adminSearchScore(');
const end=source.indexOf('\nasync function loadAdminSearchInboxCache(',start);
assert.ok(start>=0&&end>start,'global search scorer and indexer found');

function fixture(tickets){
  const ctx=vm.createContext({
    adminClientsData:[],adminProvisioningData:[],adminFleetData:{agents:[],automations:[]},
    adminPhoneData:[],adminWebsiteData:{prospects:[],topPages:[],sources:[]},adminCampaignData:[],
    adminSupportData:tickets,adminFeedbackData:[],adminFinanceData:{expenses:[]},
    adminDocumentsData:{agreements:[],company:[],standard:[]},adminHealthData:[],
    adminReadinessData:{blockers:[]},adminInboxData:{gmail:{threads:[]}},financeMoney:()=>'',String,Array,Math
  });
  vm.runInContext(source.slice(start,end),ctx);
  return query=>{ctx.query=query;return Array.from(vm.runInContext('adminGlobalSearchItems(query)',ctx))};
}
test('admin global search locates a support ticket by client reply body',()=>{
  const search=fixture([{id:'ticket-1',subject:'Equipment access',workspaceName:'Sample workspace',
    email:'sample@example.test',messages:[
      {direction:'client',body:'Please update our callback window.'},
      {direction:'support',body:'The technician can arrive after 4 pm. Unique-Search-Phrase'}]}]);
  const results=search('unique-search-phrase');
  assert.equal(results.length,1);
  assert.equal(results[0].type,'support');
  assert.equal(results[0].id,'ticket-1');
  assert.equal(results[0].view,'client-care');
});
test('global search handles a legacy support ticket with no messages and still indexes original request',()=>{
  const search=fixture([{id:'ticket-legacy',subject:'Voicemail',message:'Legacy request keyword-voicemail',
    messages:null}]);
  assert.equal(search('keyword-voicemail')[0].id,'ticket-legacy');
  assert.equal(search('no such support reply').filter(x=>x.type==='support').length,0);
});
test('search does not mistake unrelated support ticket for message-body match',()=>{
  const search=fixture([{id:'a',subject:'Billing support',messages:[{body:'Resend the September invoice'}]},
    {id:'b',subject:'Billing support',messages:[{body:'Change the payment address'}]}]);
  assert.deepEqual(search('september invoice').filter(x=>x.type==='support').map(x=>x.id),['a']);
});
