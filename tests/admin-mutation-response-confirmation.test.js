const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('dashboard.js','utf8');

function segment(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,start+' must exist');
  return source.slice(a,b);
}

test('admin business-record mutations require confirmed canonical payloads',()=>{
  const campaignSave=segment('async function saveCampaign(','\nfunction companyDocumentIsExpired(');
  const campaignDelete=segment('async function deleteCampaign(','\nasync function saveCampaign(');
  const docSave=segment('async function saveCompanyDocument(','\nasync function deleteCompanyDocument(');
  const docDelete=segment('async function deleteCompanyDocument(','\nasync function updateWebsiteProspect(');
  const support=segment('async function updateSupportStatus(','\nfunction setPlatformSettingsDirty(');
  assert.match(campaignSave,/data\.ok!==true/);assert.match(campaignSave,/data\.campaign/);
  assert.match(campaignDelete,/data\.ok!==true/);
  assert.match(docSave,/data\.document/);assert.match(docSave,/String\(data\.document\.id/);
  assert.match(docDelete,/data\.deleted/);assert.match(docDelete,/String\(data\.deleted\.id/);
  assert.match(support,/data\.ticket/);assert.match(support,/String\(data\.ticket\.status/);
  assert.doesNotMatch(support,/data\.ticket\|\|\{status\}/);
});

test('platform and phone mutations reject bare successful responses',()=>{
  const platform=segment('async function savePlatformSettings(','\ndocument.getElementById(\'savePlatformSettings\')');
  const phoneDelete=segment('async function deletePhone(','\nfunction openPhoneModal(');
  const phoneSave=segment('async function savePhone(','\ndocument.getElementById(\'addPhoneButton\')');
  assert.match(platform,/data\.ok!==true/);assert.match(platform,/data\.settings/);assert.match(platform,/updatedAt/);
  assert.match(phoneDelete,/data\.deleted/);assert.match(phoneDelete,/data\.ok!==true/);
  assert.match(phoneSave,/data\.number/);assert.match(phoneSave,/data\.ok!==true/);
});

test('admin access and support mutations verify acknowledgements before claiming success',()=>{
  const login=segment('async function sendClientLogin(','\nasync function forceClientLogout(');
  const logout=segment('async function forceClientLogout(','\nasync function repairClientAccess(');
  const repair=segment('async function repairClientAccess(','\nasync function applyAdminConfigOverride(');
  const override=segment('async function applyAdminConfigOverride(','\nasync function restoreAdminAudit(');
  const restore=segment('async function restoreAdminAudit(','\ndocument.getElementById(\'adminConfigSection\')');
  const clientView=segment('async function viewAdminClient(','\ndocument.getElementById(\'adminSaveClientButton\')');
  const retention=segment('async function requestRetention(','\nretentionModal?.querySelectorAll');
  const profile=segment('async function saveProfile(','\nfunction initProfileControls(');
  assert.match(login,/data\.ok!==true/);assert.match(login,/data\.email/);
  assert.match(logout,/data\.sessionVersion/);assert.match(logout,/data\.ok!==true/);
  assert.match(repair,/data\.email/);assert.match(repair,/data\.sessionVersion/);
  assert.match(override,/Object\.hasOwn\(data,'value'\)/);
  assert.match(restore,/Object\.hasOwn\(data,'value'\)/);
  assert.match(clientView,/data\.workspace/);assert.match(clientView,/data\.redirect!=='\/dashboard'/);
  assert.match(retention,/data\.ticket/);
  assert.match(profile,/data\.profile/);assert.match(profile,/data\.ok!==true/);
});
