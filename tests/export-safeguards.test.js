const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','api','account.js'),'utf8');

test('workspace exports recursively redact secret-shaped fields',()=>{
  assert.match(src,/function redactExportSecrets\(value\)/);
  assert.match(src,/\[redacted\]/);
  assert.match(src,/api\[_-\]\?key/);
  assert.match(src,/access\[_-\]\?token/);
  assert.match(src,/refresh\[_-\]\?token/);
  assert.match(src,/webhook\[_-\]\?secret/);
});

test('all workspace export sections pass through the redactor',()=>{
  for(const field of ['workspace','settings','agent','phone','locations','integrations','calls','leads','conversations','appointments','automations','support','onboarding','audit']){
    assert.match(src,new RegExp(field+':redactExportSecrets\\('),field+' is not redacted in export');
  }
});
