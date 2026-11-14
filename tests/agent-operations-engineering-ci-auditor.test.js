'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ci=require('../lib/agent-operations-engineering-ci');
const sha='a'.repeat(40);
test('Auditor: already cancelled inspection cannot reach transport',async()=>{
 let calls=0;const v=await ci.inspect({sourceCommit:sha,signal:AbortSignal.abort(),fetchImpl:async()=>{calls++;throw Error('must not run');}});
 assert.equal(calls,0);assert.equal(v.status,'unavailable');assert.equal(v.diagnostic,'cancelled');
});
test('Auditor: response-stream interruption preserves no partial provider data',async()=>{
 const signal=new AbortController();const v=await ci.inspect({sourceCommit:sha,signal:signal.signal,fetchImpl:async()=>({ok:true,headers:new Headers(),body:(async function*(){yield Buffer.from('{"workflow_runs":[');signal.abort();throw Error('Bearer do-not-retain');})()})});
 assert.equal(v.diagnostic,'cancelled');assert.deepEqual(v.runs,[]);assert.equal(JSON.stringify(v).includes('do-not-retain'),false);assert.equal(ci.valid(v,sha),true);
});
test('Auditor: empty metadata and unrelated workflows cannot imply successful CI',async()=>{
 const v=await ci.inspect({sourceCommit:sha,fetchImpl:async()=>new Response(JSON.stringify({workflow_runs:[{id:1,path:'.github/workflows/other.yml',head_sha:sha,status:'completed',conclusion:'success',name:'private'}]}))});
 assert.equal(v.status,'available');assert.deepEqual(v.runs,[]);assert.equal(Object.hasOwn(v,'passed'),false);assert.equal(v.diagnostic,'public-metadata-only');assert.equal(JSON.stringify(v).includes('private'),false);
});
test('Auditor: provider redirects and oversized streamed bodies fail closed',async()=>{
 for(const response of [new Response('',{status:302,headers:{Location:'https://evil.test/?token=secret'}}),new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(125001));c.enqueue(new Uint8Array(125001));c.close();}}))]){
  const v=await ci.inspect({sourceCommit:sha,fetchImpl:async()=>response});assert.equal(v.status,'unavailable');assert.deepEqual(v.runs,[]);assert.equal(JSON.stringify(v).includes('secret'),false);
 }
});
