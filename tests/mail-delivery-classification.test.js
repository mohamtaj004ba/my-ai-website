const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('lib/mail.js','utf8');

function loadMail({apiKey='key',statusCode=200,transportError=false}={}){
  const fakeHttps={request(_opts,onResponse){
    const handlers={};
    const req={on(name,fn){handlers[name]=fn;return req},write(){},end(){
      if(transportError){handlers.error?.(Error('socket reset'));return}
      const responseHandlers={},res={statusCode,on(name,fn){responseHandlers[name]=fn;return res}};
      onResponse(res);responseHandlers.data?.(statusCode>=200&&statusCode<300?'{"id":"queued"}':'rejected');responseHandlers.end?.();
    }};
    return req;
  }};
  const module={exports:{}};
  const ctx=vm.createContext({module,exports:module.exports,require:name=>{if(name==='https')return fakeHttps;throw Error('unexpected require '+name)},process:{env:{MAILGUN_API_KEY:apiKey,MAILGUN_DOMAIN:'notify.callercore.com'}},Buffer,URLSearchParams,Promise,String,Error});
  vm.runInContext(source,ctx);return module.exports.sendMail;
}

test('missing Mailgun configuration is a proven failed delivery',async()=>{
  const sendMail=loadMail({apiKey:''});
  await assert.rejects(sendMail({to:'a@example.com',subject:'x'}),err=>err.deliveryState==='failed'&&err.code==='MAIL_NOT_CONFIGURED');
});
test('Mailgun HTTP rejection is retry-safe failed delivery',async()=>{
  const sendMail=loadMail({statusCode:500});
  await assert.rejects(sendMail({to:'a@example.com',subject:'x'}),err=>err.deliveryState==='failed'&&err.code==='MAIL_PROVIDER_REJECTED');
});
test('Mailgun transport errors are uncertain because provider acceptance cannot be disproved',async()=>{
  const sendMail=loadMail({transportError:true});
  await assert.rejects(sendMail({to:'a@example.com',subject:'x'}),err=>err.deliveryState==='uncertain'&&err.code==='MAIL_TRANSPORT_UNCERTAIN');
});
