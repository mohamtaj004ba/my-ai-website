const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const kvSrc=fs.readFileSync(path.join(root,'lib','kv.js'),'utf8');
const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
}

test('Preview KV maps isolated prefixed credentials and fails closed when missing',()=>{
  assert.match(kvSrc,/VERCEL_ENV/);
  for(const name of [
    'PREVIEW_KV_KV_REST_API_URL',
    'PREVIEW_KV_KV_REST_API_TOKEN',
    'PREVIEW_KV_KV_REST_API_READ_ONLY_TOKEN',
    'PREVIEW_KV_KV_URL',
    'PREVIEW_KV_REDIS_URL'
  ]) assert.ok(kvSrc.includes(name),name+' mapping missing');
  assert.match(kvSrc,/Preview KV isolation credentials missing/);
});

test('all server KV consumers go through the centralized CallerCore KV boundary',()=>{
  const files=[...walk(path.join(root,'api')),...walk(path.join(root,'lib'))].filter(f=>f.endsWith('.js'));
  const offenders=[];
  for(const file of files){
    if(file===path.join(root,'lib','kv.js'))continue;
    const src=fs.readFileSync(file,'utf8');
    if(src.includes("require('@vercel/kv')")||src.includes('require("@vercel/kv")'))offenders.push(path.relative(root,file));
  }
  assert.deepEqual(offenders,[]);
});

test('health exposes storage mode without exposing credentials',()=>{
  assert.match(account,/storage:storageEnvironment\(\)/);
  assert.match(kvSrc,/return isPreview\?'preview-isolated':'standard'/);
  assert.doesNotMatch(account,/PREVIEW_KV_KV_REST_API_TOKEN/);
});
