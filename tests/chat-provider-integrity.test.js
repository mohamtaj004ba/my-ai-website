const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const src=fs.readFileSync('api/chat.js','utf8');

test('public chat does not expose raw OpenAI error payloads',()=>{
  assert.match(src,/console\.error\('OpenAI API error:', upstreamCode\(data\)\)/);
  assert.match(src,/res\.status\(502\)\.json\(\{ error: 'Upstream API error' \}\)/);
  assert.doesNotMatch(src,/detail:\s*data/);
});

test('public chat verifies a structured OpenAI text response before returning HTTP 200',()=>{
  assert.match(src,/!parsed\|\|typeof parsed!=='object'\|\|Array\.isArray\(parsed\)\|\|!Array\.isArray\(parsed\.output\)/);
  assert.match(src,/parsed\.output\.flatMap/);
  assert.match(src,/item\.type==='output_text'/);
  assert.match(src,/OpenAI chat response did not contain verified text/);
  assert.match(src,/res\.status\(502\)\.json\(\{ error: 'Assistant response unavailable' \}\)/);
});

test('visitor questions use plan-aligned guidance without promising unverified activation or demo availability',async()=>{
  let submitted;
  const context={module:{exports:{}},process:{env:{OPENAI_API_KEY:'test-key'}},Buffer,URL,console,require(name){
    if(name==='https')return {request(options,callback){let responseHandlers={};return {on(){},write(body){submitted=JSON.parse(body)},end(){callback({statusCode:200,on(event,fn){responseHandlers[event]=fn}});responseHandlers.data(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Setup includes testing before activation.'}]}]}));responseHandlers.end()}}}};
    if(name==='../lib/rate-limit')return {rateLimit:async()=>({limited:false}),requestIp:()=> 'test'};
    if(name==='../lib/safe-log')return {safeError:()=> 'safe',upstreamCode:()=> 'safe'};
    throw new Error(name);
  }};
  vm.runInNewContext(src,context);
  const result={};const res={setHeader(){},status(code){result.code=code;return this},json(body){result.body=body;return this}};
  await context.module.exports({method:'POST',headers:{origin:'https://callercore.com',host:'callercore.com'},body:{messages:[{role:'user',content:'Will you be answering my calls tomorrow?'}]}},res);
  assert.equal(result.code,200);
  assert.equal(submitted.input[0].content,'Will you be answering my calls tomorrow?');
  assert.match(submitted.instructions,/Payment starts setup, not live answering/);
  assert.match(submitted.instructions,/cannot verify its current availability from this chat/);
  assert.match(submitted.instructions,/business-specific intake questions, and priority routing and escalation/);
  assert.doesNotMatch(submitted.instructions,/within one business day|Setup takes about a business day|most popular|white-glove|book a free demo/);
  assert.equal(result.body.reply,'Setup includes testing before activation.');
});
