const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const api=fs.readFileSync('api/account.js','utf8');
const ui=fs.readFileSync('dashboard.js','utf8');

const apiStart=api.indexOf('async function adminProvisioning(req,res)');
const apiEnd=api.indexOf('\nasync function stripeConfigurationHealth(',apiStart);
assert.ok(apiStart>=0&&apiEnd>apiStart);
const apiBlock=api.slice(apiStart,apiEnd);

test('provisioning read exposes onboarding revision used by checklist saves',()=>{
  assert.match(apiBlock,/onboardingUpdatedAt:Number\(onboarding\?\.updatedAt\|\|0\)/);
});

test('checklist mutation requires the displayed onboarding revision',()=>{
  const start=api.indexOf('async function adminProvisioningChecklistSave(');
  const end=api.indexOf('\nasync function stripeConfigurationHealth(',start);
  const block=api.slice(start,end);
  assert.match(block,/hasOwnProperty\.call\(body,'expectedUpdatedAt'\)/);
  assert.match(block,/Number\(body\.expectedUpdatedAt\)!==Number\(state\.updatedAt\|\|0\)/);
  assert.match(block,/Onboarding changed since this view loaded/);
});

test('admin checklist actions send the displayed onboarding revision',()=>{
  const approve=ui.slice(ui.indexOf('async function approveProvisioningBuild('),ui.indexOf('\nfunction setProvisioningChecklistControls',ui.indexOf('async function approveProvisioningBuild(')));
  const update=ui.slice(ui.indexOf('async function updateProvisioningChecklist('),ui.indexOf('\nfunction setProvisioningStageControls',ui.indexOf('async function updateProvisioningChecklist(')));
  assert.match(approve,/expectedUpdatedAt=Number\(item\.onboardingUpdatedAt\|\|0\)/);
  assert.match(approve,/JSON\.stringify\(\{id,field:'adminReview',value:true,expectedUpdatedAt\}\)/);
  assert.match(update,/expectedUpdatedAt=Number\(item\.onboardingUpdatedAt\|\|0\)/);
  assert.match(update,/JSON\.stringify\(\{id:key,field,value,expectedUpdatedAt\}\)/);
  assert.match(update,/onboarding record is no longer available/i);
});
