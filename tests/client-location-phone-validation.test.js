const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const start=source.indexOf('async function persistLocations('),end=source.indexOf('\nasync function deleteLocation(',start);
assert.ok(start>=0&&end>start);

function fixture(){
  const elements=new Map();
  function el(id){
    if(!elements.has(id))elements.set(id,{value:'',checked:true,textContent:'',className:'',dataset:{},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true}});
    return elements.get(id);
  }
  el('locationModal').dataset.editId='';el('locationName').value='Main office';el('locationTimezone').value='America/Los_Angeles';
  const requests=[];
  const ctx=vm.createContext({
    document:{getElementById:el},locationMutationPending:false,locationsData:[],locationsLimit:50,
    lockFormControls:()=>()=>{},renderLocations(){},setLocationActionStatus(){},closeLocationModal(){ctx.closed=true},
    Number,String,Array,Set,
    fetch:(url,options)=>{requests.push({url,options});return Promise.resolve({ok:true,json:async()=>({ok:true,limit:50,locations:[{id:'l1',name:'Main office',phone:el('locationPhone').value,updatedAt:1}]})})}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return {ctx,el,requests};
}

test('location phone shares accessible validation status',()=>{
  assert.match(html,/id="locationPhone"[^>]*aria-describedby="locationFormStatus"/);
});

test('location save rejects malformed phone before network mutation and focuses it',async()=>{
  const f=fixture();f.el('locationPhone').value='abc';
  assert.equal(await vm.runInContext('saveLocation()',f.ctx),false);
  assert.equal(f.requests.length,0);
  assert.equal(f.el('locationPhone')['aria-invalid'],'true');
  assert.equal(f.el('locationPhone').focused,true);
  assert.match(f.el('locationFormStatus').textContent,/valid location phone number/i);
});

test('blank location phone remains optional and clears stale invalid state',async()=>{
  const f=fixture();f.el('locationPhone')['aria-invalid']='true';f.el('locationPhone').value='';
  assert.equal(await vm.runInContext('saveLocation()',f.ctx),true);
  assert.equal(f.el('locationPhone')['aria-invalid'],undefined);
  assert.equal(f.requests.length,1);
  assert.equal(f.ctx.closed,true);
});
