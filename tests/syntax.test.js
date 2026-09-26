const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
test('server and dashboard JavaScript parses',()=>{
  const files=[...walk(path.join(__dirname,'..','api')),...walk(path.join(__dirname,'..','lib')),path.join(__dirname,'..','dashboard.js'),path.join(__dirname,'..','site.js')].filter(f=>f.endsWith('.js'));
  const errors=[];
  for(const file of files){try{new Function(fs.readFileSync(file,'utf8'))}catch(e){errors.push(path.relative(path.join(__dirname,'..'),file)+': '+e.message)}}
  assert.deepEqual(errors,[]);
});
