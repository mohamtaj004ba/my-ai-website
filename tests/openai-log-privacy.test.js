const test=require('node:test');
const assert=require('node:assert/strict');
const {upstreamCode,safeError}=require('../lib/safe-log');
test('OpenAI JSON errors retain safe diagnostic codes without exposing their message',()=>{
  assert.equal(upstreamCode(JSON.stringify({error:{type:'invalid_request_error',code:'invalid_api_key',message:'Incorrect API key sk-proj-secret123 customer@example.com'}})),'invalid_request_error:invalid_api_key');
  assert.equal(upstreamCode('not json'),'upstream_error');
  assert.equal(upstreamCode({error:{type:'customer@example.com',code:'sk-proj-secret123'}}),'upstream_error');
});
test('OpenAI project credentials are redacted from generic errors',()=>{
  assert.equal(safeError(new Error('Incorrect API key sk-proj-secret123')),'Incorrect API key [secret]');
});
