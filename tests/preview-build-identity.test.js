const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('api/account.js','utf8');
function run(allowed,env){
 const result={},res={setHeader(k,v){result[k]=v},status(s){result.status=s;return this},json(data){result.data=data;return result}};
 const ctx=vm.createContext({process:{env},previewQaRequestAllowed:()=>allowed});
 vm.runInContext(source.slice(source.indexOf('function previewQaBuild('),source.indexOf('async function previewQaSession(')),ctx);
 ctx.previewQaBuild({},res);return result;
}
test('exact Preview identity keeps the existing Preview QA authorization gate and rejects absent or unsafe metadata',()=>{
 assert.equal(run(false,{}).status,404);
 for(const env of [{},{VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'callercore.com'},{VERCEL_GIT_COMMIT_SHA:'invalid',VERCEL_URL:'my-ai-website-exact.vercel.app'}])assert.equal(run(true,env).status,503);
});
test('authorized Preview identity reports only the immutable build URL and SHA without caching',()=>{
 const r=run(true,{VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'my-ai-website-exact.vercel.app',SECRET:'not-exposed'});
 assert.equal(r.status,200);assert.equal(r['Cache-Control'],'no-store');assert.equal(r.data.sha,'a'.repeat(40));assert.equal(r.data.url,'https://my-ai-website-exact.vercel.app');assert.deepEqual(Object.keys(r.data).sort(),['sha','url']);
});
