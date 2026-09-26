const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const source=require('node:fs').readFileSync('dashboard.js','utf8');
function fixture(){
  const pending=[],save={disabled:false},status={};let rendered=0;
  const ctx=vm.createContext({settingsEditing:true,settingsSaving:false,clientEditGeneration:1,businessLogoRequest:0,businessLogoProcessing:false,pendingBusinessLogo:'original',document:{getElementById:id=>id==='saveSettingsButton'?save:status},resizeBusinessLogo:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),renderBusinessLogo:()=>rendered++});
  vm.runInContext(source.slice(source.indexOf('function resetBusinessLogoProcessing('),source.indexOf('function settingsFieldError(')),ctx);
  return {ctx,save,status,pending,rendered:()=>rendered,prepare:()=>vm.runInContext('prepareBusinessLogo({})',ctx),cancel:()=>vm.runInContext('resetBusinessLogoProcessing()',ctx)};
}
test('logo processing blocks save until the prepared image becomes part of the draft',async()=>{
  const f=fixture(),p=f.prepare();assert.equal(f.save.disabled,true);assert.equal(f.ctx.businessLogoProcessing,true);
  f.pending[0].resolve('image');await p;assert.equal(f.ctx.pendingBusinessLogo,'image');assert.equal(f.save.disabled,false);assert.equal(f.rendered(),1);
});
test('a canceled or superseded logo request cannot alter the next draft',async()=>{
  const f=fixture(),first=f.prepare();f.cancel();f.ctx.clientEditGeneration++;const second=f.prepare();
  f.pending[0].resolve('stale');await first;assert.equal(f.ctx.pendingBusinessLogo,'original');assert.equal(f.save.disabled,true);
  f.pending[1].resolve('latest');await second;assert.equal(f.ctx.pendingBusinessLogo,'latest');
});
test('failed image processing preserves the existing logo and enables retry',async()=>{
  const f=fixture(),p=f.prepare();f.pending[0].reject(Error('Invalid image'));await p;
  assert.equal(f.ctx.pendingBusinessLogo,'original');assert.equal(f.save.disabled,false);assert.equal(f.ctx.businessLogoProcessing,false);assert.equal(f.status.textContent,'Invalid image');
});
