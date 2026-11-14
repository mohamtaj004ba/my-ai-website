const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.join(__dirname,'..','scripts','report-codeql.mjs');

test('CodeQL diagnostics print rule, security severity, file, line and title without source snippets',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'callercore-codeql-'));
  try{
    fs.writeFileSync(path.join(dir,'javascript.sarif'),JSON.stringify({runs:[{
      tool:{driver:{rules:[{id:'js/test-rule',shortDescription:{text:'Test code security rule'},properties:{'security-severity':'8.1'}}]}},
      results:[{ruleId:'js/test-rule',message:{text:'Sensitive source code must not appear in the log'},
        locations:[{physicalLocation:{artifactLocation:{uri:'api/example.js'},region:{startLine:42}}}]}]
    }]}));
    const result=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/js\/test-rule \[security severity 8\.1\] api\/example\.js:42/);
    assert.match(result.stdout,/Test code security rule/);
    assert.match(result.stdout,/Total SARIF results: 1/);
    assert.doesNotMatch(result.stdout,/Sensitive source code/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('CodeQL diagnostics fail closed when SARIF files are missing',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'callercore-codeql-empty-'));
  try{
    const result=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/No CodeQL SARIF files found/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
