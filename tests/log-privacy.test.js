const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}

test('server logs do not emit raw error objects request bodies or provider payloads',()=>{
  const files=[...walk(path.join(root,'api')),...walk(path.join(root,'lib'))].filter(f=>f.endsWith('.js'));
  const bad=[];
  for(const file of files){
    const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
    lines.forEach((line,i)=>{
      if(!/console\.(?:error|warn|log|debug)\(/.test(line))return;
      const scrubbed=line
        .replace(/safeError\([^)]*\)/g,'[safe]')
        .replace(/upstreamCode\([^)]*\)/g,'[safe]');
      if(/console\.(?:error|warn|log|debug)\([^\n]*(?:req\.body|rawBody|authorization|refreshToken|accessToken|client_secret|api[_-]?key|webhook[_-]?secret)/i.test(scrubbed))bad.push(path.relative(root,file)+':'+(i+1));
      if(/console\.(?:error|warn)\([^\n]*[,()]\s*(?:err|e|data)\s*\)/.test(scrubbed))bad.push(path.relative(root,file)+':'+(i+1));
    });
  }
  assert.deepEqual([...new Set(bad)],[]);
});

test('AI endpoints never log raw upstream response bodies',()=>{
  for(const rel of ['api/chat.js','api/onboarding-chat.js']){
    const src=fs.readFileSync(path.join(root,rel),'utf8');
    assert.doesNotMatch(src,/Anthropic API error:',\s*data/);
    assert.doesNotMatch(src,/Parse error:',\s*err,\s*data/);
    assert.match(src,/upstreamCode\(data\)/);
  }
});

test('privacy-safe logger redacts common identifiers and secret shapes',()=>{
  const src=fs.readFileSync(path.join(root,'lib','safe-log.js'),'utf8');
  assert.match(src,/\[url\]/);
  assert.match(src,/\[email\]/);
  assert.match(src,/\[phone\]/);
  assert.match(src,/\[secret\]/);
  assert.match(src,/slice\(0,500\)/);
});
