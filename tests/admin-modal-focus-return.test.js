const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const js=fs.readFileSync('dashboard.js','utf8');

function block(name,next){
  const start=js.indexOf('function '+name+'('),end=js.indexOf('\nfunction '+next+'(',start);
  assert.ok(start>=0&&end>start,name+' block exists');
  return js.slice(start,end);
}

test('admin editors delay primary-field focus until shared modal return-focus state is captured',()=>{
  const prospect=block('openProspectModal','closeProspectModal');
  const campaign=block('openCampaignModal','closeCampaignModal');
  const company=block('openCompanyDocumentModal','closeCompanyDocumentModal');
  const phone=block('openPhoneModal','closePhoneModal');
  const expense=block('openExpenseModal','closeExpenseModal');

  assert.match(prospect,/setTimeout\(\(\)=>nameInput\?\.focus\?\.\(\),20\)/);
  assert.match(campaign,/setTimeout\(\(\)=>name\?\.focus\?\.\(\),20\)/);
  assert.match(company,/setTimeout\(\(\)=>name\?\.focus\?\.\(\),20\)/);
  assert.match(phone,/setTimeout\(\(\)=>numberInput\?\.focus\?\.\(\),20\)/);
  assert.match(expense,/setTimeout\(\(\)=>nameInput\?\.focus\?\.\(\),20\)/);
});
