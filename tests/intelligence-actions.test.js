const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {validateIntent,responseText}=require('../lib/intelligence-actions');
const src=fs.readFileSync('api/account.js','utf8'),block=src.slice(src.indexOf('async function intelligenceAccess('),src.indexOf('async function clientAiGuide('));
function fixture({admin=false,plan='Pro',readOnly=false,cas=true}={}){
  const session={email:'owner@example.test',workspaceId:'own',role:admin?'admin':'owner'},records={'workspace:own':{id:'own',name:'Owner business',plan},'workspace:other':{id:'other',name:'Other business',plan:'Pro'},'agent:own':{name:'Maya',openingMessage:'Old greeting',updatedAt:10,transferNumber:'5551234567'},'agent:other':{name:'Maya',openingMessage:'Other greeting',updatedAt:20},'calls:own':[{id:'call1',caller:'Caller'}],'followup:state:own':{call1:{status:'needs_action',updatedAt:8}}},invoked=[];
  const ctx=vm.createContext({crypto,validateIntent,Date,requireWritableSession:async()=>readOnly?null:session,requireAdmin:async()=>admin?session:null,requireOperationalWorkspace:async()=>true,entitlementsFor:plan=>({plan}),kv:{get:async k=>records[k]??null,expire:async()=>true,set:async(k,v)=>{records[k]=v}},compareAndSetConfig:async(_,changes)=>{if(!cas)return false;for(const c of changes){if(JSON.stringify(records[c.key])!==JSON.stringify(c.before))return false;records[c.key]=c.after}return true},saveAgent:async(req,res)=>{invoked.push(['agent',req.body,req]);return res.status(200).json({ok:true})},followupUpdate:async(req,res)=>{invoked.push(['followup',req.body]);return res.status(200).json({ok:true})},createSupportTicket:async(req,res)=>{invoked.push(['request',req.body]);return res.status(200).json({ok:true})},adminOverrideConfig:async(req,res)=>{invoked.push(['admin',req.body]);return res.status(200).json({ok:true})}});
  vm.runInContext(block,ctx);return {ctx,records,invoked,session,prepare:raw=>ctx.prepareIntelligenceAction(session,raw,admin),async apply(id,request){const result={};const res={status(code){result.code=code;return this},json(body){result.body=body;return this}};await ctx.applyIntelligenceAction(request||{body:{id}},res);return result}};
}
test('Intelligence denies provider, access, billing and cross-role tool intents',()=>{
  for(const field of ['transferNumber','voiceId','authVersion','plan','__proto__'])assert.throws(()=>validateIntent({kind:'receptionist',target:'other',field,value:'new'},{admin:true}));
  assert.throws(()=>validateIntent({kind:'followup',target:'call1',field:'status',value:'completed'},{admin:true}));
  assert.throws(()=>validateIntent({kind:'admin_request',target:'',field:'Help',value:'Please help me',billing:true}));
});
test('Responses validation rejects partial, malformed and provider error output',()=>{
  for(const data of [null,{},[],{output:[],status:'incomplete'},{output:[],error:{message:'bad'}}])assert.throws(()=>responseText(data));
  assert.equal(responseText({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Verified answer'}]}]}),'Verified answer');
});
test('proposed receptionist values obey canonical field limits before review',()=>{
  for(const [field,limit] of Object.entries({name:80,role:120,tone:80,openingMessage:1200,serviceArea:500,businessHours:500,handlingInstructions:1800})){
    assert.throws(()=>validateIntent({kind:'receptionist',target:'',field,value:'x'.repeat(limit+1)}));
    assert.equal(validateIntent({kind:'receptionist',target:'',field,value:'x'.repeat(limit)}).value.length,limit);
  }
  assert.equal(validateIntent({kind:'receptionist',target:'',field:'openingMessage',value:'  A helpful greeting  '}).value,'A helpful greeting');
});
test('client proposals bind to the authenticated workspace despite a model supplied target',async()=>{
  const f=fixture(),p=await f.prepare({kind:'receptionist',target:'other',field:'openingMessage',value:'New greeting'});
  assert.equal(f.invoked.length,0);assert.equal(f.records['agent:own'].openingMessage,'Old greeting');
  const out=await f.apply(p.id);assert.equal(out.code,200);assert.equal(f.invoked[0][0],'agent');assert.equal(f.invoked[0][1].expectedUpdatedAt,10);assert.equal(f.invoked[0][1].section,'identity');assert.equal(f.invoked[0][1].openingMessage,'New greeting');assert.equal(f.invoked[0][1].transferNumber,undefined);
  assert.equal((await f.apply(p.id)).code,409);assert.equal(f.invoked.length,1);
});
test('apply rechecks Pro entitlement, read-only session, ownership, expiration and concurrency',async()=>{
  let f=fixture(),p=await f.prepare({kind:'followup',target:'call1',field:'status',value:'completed'});f.records['workspace:own'].plan='Growth';assert.equal((await f.apply(p.id)).code,403);assert.equal(f.invoked.length,0);
  f=fixture({readOnly:true});p=await f.prepare({kind:'followup',target:'call1',field:'status',value:'dismissed'});await f.apply(p.id);assert.equal(f.invoked.length,0);
  for(const mutate of [p=>p.actor='someone@example.test',p=>p.homeWorkspace='other',p=>p.expiresAt=0,p=>p.expiresAt='corrupt',p=>p.status='attempted']){f=fixture();p=await f.prepare({kind:'followup',target:'call1',field:'status',value:'pending'});mutate(f.records['intelligence:proposal:'+p.id]);const out=await f.apply(p.id);assert.ok([404,409].includes(out.code));assert.equal(f.invoked.length,0);}
  f=fixture({cas:false});p=await f.prepare({kind:'followup',target:'call1',field:'status',value:'pending'});assert.equal((await f.apply(p.id)).code,409);assert.equal(f.invoked.length,0);
});
test('admin proposal reuses override with the complete server revision snapshot',async()=>{
  const f=fixture({admin:true}),p=await f.prepare({kind:'receptionist',target:'other',field:'openingMessage',value:'New greeting'});assert.equal((await f.apply(p.id)).code,200);const body=f.invoked[0][1];assert.equal(body.id,'other');assert.equal(body.expectedBefore.updatedAt,20);assert.equal(body.value.name,'Maya');assert.equal(body.value.openingMessage,'New greeting');
});
test('unsupported source data fails before an action is offered',async()=>{
  const f=fixture();f.records['agent:own']=[];await assert.rejects(f.prepare({kind:'receptionist',target:'',field:'openingMessage',value:'New greeting'}));assert.equal(f.invoked.length,0);
  f.records['calls:own']={};await assert.rejects(f.prepare({kind:'followup',target:'call1',field:'status',value:'completed'}));
});
test('apply preserves native request headers and restores the submitted body',async()=>{
  const f=fixture(),p=await f.prepare({kind:'receptionist',target:'',field:'openingMessage',value:'New greeting'});
  const original={id:p.id},request=Object.create({headers:{cookie:'session=test-session'}});request.body=original;
  assert.equal((await f.apply(p.id,request)).code,200);
  assert.equal(f.invoked[0][2],request);assert.equal(f.invoked[0][2].headers.cookie,'session=test-session');assert.equal(request.body,original);
});
test('canonical handler failure restores the request and prevents automatic replay',async()=>{
  const f=fixture(),p=await f.prepare({kind:'receptionist',target:'',field:'openingMessage',value:'New greeting'}),original={id:p.id},request={body:original};
  f.ctx.saveAgent=async()=>{throw new Error('Canonical save unavailable')};
  await assert.rejects(f.apply(p.id,request),/Canonical save unavailable/);assert.equal(request.body,original);assert.equal((await f.apply(p.id)).code,409);
});
