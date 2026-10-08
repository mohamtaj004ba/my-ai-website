const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
test('obsolete v2 prototype pages are not shipped',()=>{
  for(const name of ['homepage-v2.html','contact-v2.html','get-started-v2.html','live-demo-v2.html'])assert.equal(fs.existsSync(path.join(root,name)),false,name+' should remain removed');
});
test('old v2 URLs retain permanent redirects',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const redirects=new Map((config.redirects||[]).map(x=>[x.source,x]));
  for(const [source,dest] of [['/homepage-v2','/'],['/contact-v2','/contact'],['/get-started-v2','/get-started'],['/live-demo-v2','/live-demo']]){
    assert.equal(redirects.get(source)?.destination,dest);
    assert.equal(redirects.get(source)?.permanent,true);
  }
});
