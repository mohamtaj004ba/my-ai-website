const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/account.js','utf8');
const dashboard=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('function userProfileKey('),end=source.indexOf('\nasync function requestLogin(',start);
assert.ok(start>=0&&end>start,'profile handlers exist');
const code=source.slice(start,end);

function fixture({stored=null,workspace={id:'ws-1',ownerName:'Owner'},cas=true,casError=null}={}){
  let status=200,payload,writes=0;
  const ctx=vm.createContext({
    crypto,cleanEmail:v=>String(v||'').trim().toLowerCase(),kv:{get:async key=>key.startsWith('user:profile:')?stored:workspace},
    requireSession:async()=>({workspaceId:'ws-1',email:'owner@example.test',role:'owner'}),
    requireWritableSession:async()=>({workspaceId:'ws-1',email:'owner@example.test',role:'owner'}),
    compareAndSetConfig:async(_kv,changes)=>{writes++;assert.equal(changes.length,1);if(casError)throw casError;return cas},
    safeError:()=> 'redacted',console:{error(){}},
    req:{body:{displayName:'Updated Owner',avatarDataUrl:''}},
    res:{status(n){status=n;return this},json(x){payload=x;return x}},
    Date,Array,Object,String,Number,Error
  });
  vm.runInContext(code,ctx);
  return {ctx,runRead:async()=>{await vm.runInContext('profile(req,res)',ctx);return {status,payload,writes}},runSave:async()=>{await vm.runInContext('profileSave(req,res)',ctx);return {status,payload,writes}}};
}

test('malformed stored profile fails closed for reads and writes',async()=>{
  let f=fixture({stored:'broken'});
  let out=await f.runRead();assert.equal(out.status,503);assert.equal(out.writes,0);
  f=fixture({stored:[]});out=await f.runSave();assert.equal(out.status,503);assert.equal(out.writes,0);
});

test('profile save uses a compare-and-set revision instead of blind overwrite',async()=>{
  const stored={displayName:'Old',avatarDataUrl:'',updatedAt:10};
  let f=fixture({stored,cas:false}),out=await f.runSave();
  assert.equal(out.status,409);assert.equal(out.writes,1);
  f=fixture({stored,cas:true});out=await f.runSave();
  assert.equal(out.status,200);assert.equal(out.payload.ok,true);assert.equal(out.payload.profile.displayName,'Updated Owner');assert.equal(out.writes,1);
});

test('profile save reports ambiguous storage failure without claiming success',async()=>{
  const f=fixture({stored:{displayName:'Old',avatarDataUrl:'',updatedAt:10},casError:new Error('storage uncertain')});
  const out=await f.runSave();assert.equal(out.status,503);assert.match(out.payload.error,/Could not confirm/);
});


test('profile UI serializes saves and requires the exact submitted profile receipt',()=>{
  const start=dashboard.indexOf('let profileSaving=false;'),end=dashboard.indexOf('\nfunction initProfileControls(',start),block=dashboard.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(block,/if\(profileSaving\)return false/);
  assert.match(block,/setProfileSaving\(true\)/);
  assert.match(block,/data\.ok!==true/);
  assert.match(block,/String\(confirmed\.displayName\|\|'\'\)!==displayName/);
  assert.match(block,/String\(confirmed\.avatarDataUrl\|\|'\'\)!==avatarDataUrl/);
  assert.match(block,/Number\.isFinite\(Number\(confirmed\.updatedAt\)\)/);
  assert.match(block,/finally\{setProfileSaving\(false\)\}/);
  assert.match(dashboard,/profilePhotoButton[^\n]+if\(!profileSaving\)/);
  assert.match(dashboard,/profilePhotoRemove[^\n]+if\(profileSaving\)return/);
});


test('client and admin profile save feedback is announced without stealing focus',()=>{
  for(const file of ['dashboard.html','admin-dashboard.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/id="profileSaveStatus" role="status" aria-live="polite" aria-atomic="true"/);
  }
});


test('profile name validation is announced inline and linked to the field',()=>{
  const block=dashboard.slice(dashboard.indexOf('async function saveProfile(){'),dashboard.indexOf('\nfunction initProfileControls('));
  assert.match(block,/input\.setAttribute\('aria-invalid','true'\)/);
  assert.match(block,/input\.focus\(\)/);
  assert.match(block,/input\?\.removeAttribute\('aria-invalid'\)/);
  assert.match(block,/status\.className='success'/);
  assert.match(block,/status\.className='error'/);
  for(const file of ['dashboard.html','admin-dashboard.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/id="profileNameInput"[^>]+aria-describedby="profileSaveStatus"/);
  }
});
