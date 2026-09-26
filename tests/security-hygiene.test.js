const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
test('source files do not contain common live secret formats',()=>{
  const files=[...walk(path.join(root,'api')),...walk(path.join(root,'lib')),path.join(root,'dashboard.js'),path.join(root,'site.js')].filter(f=>/\.(js|html)$/.test(f));
  const patterns=[
    /sk_live_[A-Za-z0-9]{16,}/,
    /whsec_[A-Za-z0-9]{16,}/,
    /AIza[0-9A-Za-z_-]{30,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
  ];
  const hits=[];
  for(const file of files){const src=fs.readFileSync(file,'utf8');for(const re of patterns)if(re.test(src))hits.push(path.relative(root,file)+': '+re)}
  assert.deepEqual(hits,[]);
});
test('demo reveal requires environment secret instead of a hard-coded source fallback',()=>{
  for(const name of ['api/reveal-token.js','api/demo-number.js']){
    const src=fs.readFileSync(path.join(root,name),'utf8');
    assert.match(src,/process\.env\.DEMO_TOKEN_SECRET/);
    assert.doesNotMatch(src,/DEMO_TOKEN_SECRET\s*\|\|\s*['"][^'"]+['"]/);
  }
});

test('site analytics identifiers avoid insecure randomness',()=>{
  const src=fs.readFileSync(path.join(root,'site.js'),'utf8');
  assert.doesNotMatch(src,/Math\.random\s*\(/);
  assert.match(src,/crypto\?\.randomUUID|crypto\.randomUUID/);
  assert.match(src,/getRandomValues/);
});
