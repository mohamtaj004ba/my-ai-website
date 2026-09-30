const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('api/account.js','utf8');

test('website conversation detail refuses malformed prospect, message and coverage sources',()=>{
  const start=source.indexOf('async function adminWebsiteConversation('),end=source.indexOf('\nasync function admin',start+20);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  assert.match(body,/Website prospect record is unavailable/);
  assert.match(body,/rawMessages!=null&&\(!Array\.isArray\(rawMessages\)\|\|rawMessages\.some/);
  assert.match(body,/rawCoverage!=null&&!validCoverage/);
  assert.match(body,/Website conversation coverage is unavailable/);
});
