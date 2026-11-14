const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('api/create-checkout-session.js','utf8');
async function checkout(prices,plan='Starter'){
  const leads=new Map(),requests=[];
  const modules={
    crypto:require('node:crypto'),
    '../lib/native-checkout':{},
    '../lib/billing-provider':{BillingError:class extends Error{}},
    '../lib/kv':{kv:{set:async(k,v)=>leads.set(k,v),get:async k=>leads.get(k)}},
    '../lib/rate-limit':{rateLimit:async()=>({limited:false}),requestIp:()=> 'fixture'},
    '../lib/site-analytics':{upsertWebsiteProspect:async()=>({id:'prospect_fixture',email:'buyer@example.test'}),recordSiteEvent:async()=>{}},
    '../lib/safe-log':{safeError:()=> 'redacted'}
  };
  const module={exports:{}},env={VERCEL_ENV:'preview',CALLERCORE_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_PUBLISHABLE_KEY:'pk_test_fixture',...prices};
  vm.runInNewContext(source,{module,process:{env},require(name){assert.ok(Object.hasOwn(modules,name),name);return modules[name]},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console:{error(){}},fetch:async(url,options)=>{
    assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
    const params=new URLSearchParams(options.body);requests.push(params);
    return {ok:true,json:async()=>({object:'checkout.session',id:'cs_test_fixture',client_secret:'cs_test_fixture_secret_value',client_reference_id:params.get('client_reference_id'),customer_email:params.get('customer_email'),metadata:{plan,prospect_id:'prospect_fixture'}})};
  }});
  let status;
  await module.exports({method:'POST',headers:{origin:'https://callercore.com',host:'callercore.com'},body:{name:'Buyer',business:'Fixture',email:'buyer@example.test',phone:'555-0100',industry:'Services',plan}},{setHeader(){},status(code){status=code;return this},json(){}});
  return {status,requests,leads};
}
const names=['STARTER','GROWTH','PRO','SETUP'];
const primary=Object.fromEntries(names.map(n=>['STRIPE_'+n+'_PRICE_ID','price_primary_'+n]));
const aliases=Object.fromEntries(names.map(n=>['STRIPE_PRICE_'+n,'price_alias_'+n]));
test('embedded checkout uses the same explicit price names as Preview admission',async()=>{
  for(const [env,expected] of [[primary,'primary'],[aliases,'alias'],[{...aliases,...primary},'primary']]){
    for(const plan of ['Starter','Growth','Pro']){
      const r=await checkout(env,plan);
      assert.equal(r.status,200);
      assert.equal(r.requests.length,1);
      assert.equal(r.requests[0].get('line_items[0][price]'),'price_'+expected+'_'+plan.toUpperCase());
      assert.equal(r.requests[0].get('line_items[1][price]'),'price_'+expected+'_SETUP');
    }
  }
});
test('missing Preview prices stop before saving a lead or creating a session',async()=>{
  for(const key of Object.keys(aliases)){
    const r=await checkout({...aliases,[key]:''});
    assert.equal(r.status,503);
    assert.equal(r.requests.length,0);
    assert.equal(r.leads.size,0);
  }
  const invalid=await checkout(aliases,'Setup');
  assert.equal(invalid.status,400);
  assert.equal(invalid.requests.length,0);
});
