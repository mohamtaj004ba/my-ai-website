const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function runFunction(name,endName,{admin=false,indexValue=[],recordFailure=false,indexFailure=false}={}){
  const source=fs.readFileSync('api/account.js','utf8');
  const start=source.indexOf('async function '+name+'('),end=source.indexOf('\nasync function '+endName+'(',start);
  assert.ok(start>=0&&end>start);
  const kv={
    get:async key=>{
      if(key==='support:index'){
        if(indexFailure)throw Error('storage unavailable');
        return indexValue;
      }
      if(key.startsWith('support:')){
        if(recordFailure)throw Error('storage unavailable');
        return {id:key.slice('support:'.length),workspaceId:'ws_1',messages:[],messageCount:0,createdAt:1,updatedAt:1};
      }
      return null;
    }
  };
  const ctx=vm.createContext({
    requireSession:async()=>({workspaceId:'ws_1',email:'client@example.test'}),
    requireAdmin:async()=>({email:'admin@example.test'}),
    kv,Set,Promise,Number,String,Array,Object,
    console:{error(){}},safeError:()=> 'redacted',
    req:{},res:{status(n){this.code=n;return this},json(x){this.body=x;return x}}
  });
  vm.runInContext(source.slice(start,end),ctx);
  return vm.runInContext(name+'(req,res)',ctx).then(()=>ctx.res);
}

test('client Support history returns a targeted 503 when storage reads fail',async()=>{
  const indexFailure=await runFunction('supportTickets','replySupportTicket',{indexFailure:true});
  assert.equal(indexFailure.code,503);
  assert.match(indexFailure.body.error,/temporarily unavailable/i);
  assert.match(indexFailure.body.error,/previously loaded requests should be preserved/i);

  const recordFailure=await runFunction('supportTickets','replySupportTicket',{indexValue:['ticket_1'],recordFailure:true});
  assert.equal(recordFailure.code,503);
  assert.match(recordFailure.body.error,/could not be verified/i);
  assert.match(recordFailure.body.error,/previously loaded requests should be preserved/i);
});

test('admin Support history returns a targeted 503 when storage reads fail',async()=>{
  const indexFailure=await runFunction('adminSupport','adminSupportReply',{admin:true,indexFailure:true});
  assert.equal(indexFailure.code,503);
  assert.match(indexFailure.body.error,/temporarily unavailable/i);
  assert.match(indexFailure.body.error,/previously loaded requests should be preserved/i);

  const recordFailure=await runFunction('adminSupport','adminSupportReply',{admin:true,indexValue:['ticket_1'],recordFailure:true});
  assert.equal(recordFailure.code,503);
  assert.match(recordFailure.body.error,/could not be verified/i);
  assert.match(recordFailure.body.error,/previously loaded requests should be preserved/i);
});
