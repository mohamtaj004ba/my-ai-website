const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const leadSource=fs.readFileSync('api/lead-create.js','utf8');
const embeddedSource=fs.readFileSync('api/create-checkout-session.js','utf8');
async function request({prospectError=false,leadError=false,trackError=false}={}){
  const calls={prospect:0,save:0,track:0};let status=0,body;
  const kv={set:async()=>{calls.save++;if(leadError)throw Error('KV temporarily offline')}};
  const modules={
    '../lib/safe-log':{safeError:()=> 'redacted'},
    crypto,
    '../lib/kv':{kv},
    '../lib/site-analytics':{
      upsertWebsiteProspect:async()=>{calls.prospect++;if(prospectError)throw Error('prospect unavailable');return {id:'lead-1',firstSource:'contact'}},
      recordSiteEvent:async()=>{calls.track++;if(trackError)throw Error('analytics unavailable')}
    },
    '../lib/rate-limit':{rateLimit:async()=>({limited:false}),requestIp:()=> '127.0.0.1'}
  };
  const module={exports:{}};
  vm.runInNewContext(leadSource,{module,exports:module.exports,crypto,URL,Date,String,Set,console:{error(){}},
    require:name=>{if(!(name in modules))throw Error('unexpected dependency '+name);return modules[name]}});
  const req={method:'POST',headers:{origin:'https://callercore.com',host:'callercore.com'},body:{
    name:'Client',business:'Business',email:'client@example.test',phone:'509-555-0123',industry:'Services',plan:'Starter'
  }};
  const res={setHeader(){},status(code){status=code;return this},json(data){body=data;return data}};
  await module.exports(req,res);
  return {status,body,calls};
}
test('legacy checkout remains available when tracking is unavailable after lead pre-save',async()=>{
  const r=await request({trackError:true});
  assert.equal(r.status,200);
  assert.equal(r.body.prospectId,'lead-1');
  assert.equal(typeof r.body.leadId,'string');
  assert.deepEqual(r.calls,{prospect:1,save:1,track:1});
});
test('lead persistence errors prevent checkout success and skip analytics',async()=>{
  for(const options of [{prospectError:true},{leadError:true}]){
    const r=await request(options);
    assert.equal(r.status,503);
    assert.equal(r.body.leadId,undefined);
    assert.equal(r.calls.track,0);
  }
});
test('embedded checkout tracks best-effort after successful lead save',()=>{
  const upsert=embeddedSource.indexOf('prospect=await upsertWebsiteProspect(');
  const leadSave=embeddedSource.indexOf("await kv.set('lead:'+leadId");
  const closeTry=embeddedSource.indexOf("  }catch(err){\n    console.error('Embedded checkout lead pre-save failed'");
  const tracking=embeddedSource.indexOf("try{await recordSiteEvent({type:'checkout_start'");
  const stripe=embeddedSource.indexOf("await stripeRequest('/v1/checkout/sessions'");
  assert.ok(upsert>=0&&upsert<leadSave&&leadSave<closeTry);
  assert.ok(tracking>closeTry&&tracking<stripe);
  assert.match(embeddedSource,/catch\(analyticsError\)\{console\.error\('Embedded checkout tracking failed'/);
});
