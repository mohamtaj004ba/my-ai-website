const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const source=fs.readFileSync('api/contact.js','utf8'),frontend=fs.readFileSync('contact.html','utf8');

async function request({prospectError=false,inboxError=false,trackingError=false,mailError=false}={}){
  const calls={prospect:0,inbox:0,tracking:0,mail:0};let status=0,body=null;
  const modules={
    '../lib/safe-log':{safeError:()=> 'redacted'},
    crypto,
    '../lib/kv':{kv:{}},
    './_lib/mailgun':{sendMail:async()=>{calls.mail++;if(mailError)throw Error('mailer failure')}},
    '../lib/site-analytics':{
      upsertWebsiteProspect:async()=>{calls.prospect++;if(prospectError)throw Error('database error');return {id:'lead-1'}},
      recordSiteEvent:async()=>{calls.tracking++;if(trackingError)throw Error('tracking error')}
    },
    '../lib/site-conversation':{appendSiteConversation:async(_kv,id,message)=>{
      calls.inbox++;assert.equal(id,'lead-1');assert.equal(message.body,'Please call me');
      if(inboxError)throw Error('inbox failure')
    }},
    '../lib/rate-limit':{rateLimit:async()=>({limited:false}),requestIp:()=> '127.0.0.1'}
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,URL,Date,Number,String,console:{error(){}},
    require:name=>{if(!(name in modules))throw Error('unexpected dependency '+name);return modules[name]}});
  const req={method:'POST',headers:{origin:'https://callercore.com',host:'callercore.com'},
    body:{name:'Visitor',email:'visitor@example.test',message:'Please call me',category:'General'}};
  const res={setHeader(){},status(n){status=n;return this},json(x){body=x;return x}};
  await module.exports(req,res);
  return {status,body,calls};
}
test('inquiry success confirms saved prospect and notification once',async()=>{
  const r=await request();
  assert.equal(r.status,200);
  assert.equal(r.body.ok,true);
  assert.equal(r.body.prospectId,'lead-1');
  assert.equal(r.body.warning,undefined);
  assert.deepEqual(r.calls,{prospect:1,inbox:1,tracking:1,mail:1});
});
test('mail delivery failure after persistence remains a confirmed inquiry without duplicate-request instruction',async()=>{
  const r=await request({mailError:true});
  assert.equal(r.status,200);
  assert.equal(r.body.ok,true);
  assert.match(r.body.warning,/inquiry was saved/);
  assert.match(r.body.warning,/email notification/);
  assert.doesNotMatch(r.body.warning,/submit again/i);
  assert.equal(r.calls.mail,1);
});
test('tracking failure does not turn an already-saved contact inquiry into an error',async()=>{
  const r=await request({trackingError:true});
  assert.equal(r.status,200);
  assert.equal(r.body.warning,undefined);
  assert.equal(r.calls.mail,1);
});
test('inbox history failure reports saved prospect while still attempting support notification',async()=>{
  const r=await request({inboxError:true});
  assert.equal(r.status,200);
  assert.match(r.body.warning,/conversation history could not be confirmed/);
  assert.equal(r.calls.mail,1);
});
test('prospect storage failure cannot claim receipt or trigger notification',async()=>{
  const r=await request({prospectError:true});
  assert.equal(r.status,503);
  assert.equal(r.body.ok,undefined);
  assert.deepEqual(r.calls,{prospect:1,inbox:0,tracking:0,mail:0});
});
test('contact page shows server-provided warning in success state rather than prompting duplicate contact',()=>{
  assert.match(frontend,/const body=await r\.json\(\)\.catch\(\(\)=>\(\{\}\)\)/);
  assert.match(frontend,/note\.textContent=body\.warning/);
  assert.match(frontend,/if\(!r\.ok\)throw new Error\(body\.error/);
  assert.doesNotMatch(frontend,/We could not send your message\. Please try again/);
});
