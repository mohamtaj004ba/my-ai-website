const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','lib','gmail.js'),'utf8');

test('Gmail API retries quota and concurrency responses with bounded backoff',()=>{
  assert.match(src,/for\(let attempt=0;attempt<3;attempt\+\+\)/);
  assert.match(src,/r\.status===429/);
  assert.match(src,/r\.status===403&&\/quota\|rate\|concurrent\/i\.test\(message\)/);
  assert.match(src,/Math\.min\(delay,2500\)/);
});

test('Inbox thread hydration uses conservative concurrency',()=>{
  assert.match(src,/for\(let i=0;i<refs\.length;i\+=2\)/);
  assert.match(src,/refs\.slice\(i,i\+2\)/);
  assert.match(src,/setTimeout\(r,220\)/);
});
