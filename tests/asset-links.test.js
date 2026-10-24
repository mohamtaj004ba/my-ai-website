const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');

test('local CSS JS and image references in root HTML resolve to files',()=>{
  const htmlFiles=fs.readdirSync(root).filter(n=>n.endsWith('.html'));
  const missing=[];
  for(const name of htmlFiles){
    const src=fs.readFileSync(path.join(root,name),'utf8');
    for(const m of src.matchAll(/(?:src|href)=["'](\/[^"'?#]+)["']/g)){
      const target=m[1];
      if(!/\.(?:css|js|png|jpe?g|webp|svg|ico)$/i.test(target))continue;
      const file=path.join(root,target.replace(/^\//,''));
      if(!fs.existsSync(file))missing.push(name+' -> '+target);
    }
  }
  assert.deepEqual(missing,[]);
});
