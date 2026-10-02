const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=fs.readFileSync('api/account.js','utf8');

function block(name,next){
  const start=api.indexOf('async function '+name+'('),end=api.indexOf('\nasync function '+next+'(',start);
  assert.ok(start>=0&&end>start,name+' handler found');
  return api.slice(start,end);
}

test('campaign list rejects malformed duplicate directories and unverifiable records',()=>{
  const read=block('adminMarketingCampaigns','adminMarketingCampaignSave');
  assert.match(read,/ids\.some\(id=>typeof id!=='string'\|\|!id\.trim\(\)\)/);
  assert.match(read,/new Set\(ids\)\.size!==ids\.length/);
  assert.match(read,/Campaign records could not be verified\. No partial campaign list was returned/);
  assert.match(read,/String\(campaign\.id\|\|''\)!==String\(batchIds\[i\]\)/);
});

test('campaign save and delete reject malformed stored record or directory before mutation',()=>{
  const save=block('adminMarketingCampaignSave','adminMarketingCampaignDelete');
  const del=block('adminMarketingCampaignDelete','adminDocuments');
  assert.match(save,/Campaign record could not be verified\. No changes were made/);
  assert.match(save,/new Set\(list\)\.size!==list\.length/);
  assert.match(del,/Campaign record could not be verified\. No changes were made/);
  assert.match(del,/Campaign directory is unavailable\. No changes were made/);
});
