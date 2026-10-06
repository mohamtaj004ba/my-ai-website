const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('get-started.html','utf8');
const guard=source.match(/if\(!data\|\|typeof data[\s\S]*?throw new Error\('Secure checkout response could not be verified'\);/)[0];
function accepts(clientSecret){try{vm.runInNewContext(guard,{data:{publishableKey:'pk_test_fixture',clientSecret}});return true}catch(_){return false}}
test('Stripe checkout secrets are opaque: percent-encoded suffixes pass unchanged',()=>{
 assert.equal(accepts('cs_test_fixture_secret_encoded%2Fopaque%3D'),true);
 assert.equal(accepts('cs_test_fixture_secret_plain'),true);
});
test('checkout still rejects malformed identity, missing suffix, controls and unbounded secrets',()=>{
 for(const s of ['sk_test_secret','cs_test_fixture_secret_','cs_test_fixture_secret_bad\n','cs_test_fixture_secret_'+ 'a'.repeat(512)])assert.equal(accepts(s),false);
});
