const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function experience({tokenStatus=200,revealStatus=200,networkFailure=false}={}){
  const elements=Object.fromEntries(['demoBtn','demoLabel','demoStatus','demoFallback'].map(id=>[id,{textContent:'',hidden:true,disabled:false,dataset:{},addEventListener(_,fn){this.click=fn}}]));
  let requests=0;
  const context=vm.createContext({document:{getElementById:id=>elements[id]},fetch:async url=>{requests++;if(networkFailure)throw new Error('private transport diagnostic');const status=url==='/api/reveal-token'?tokenStatus:revealStatus;return {ok:status===200,status,json:async()=>url==='/api/reveal-token'?{token:(Date.now()-2000)+'.'+'a'.repeat(64)}:{number:'+15095550100',display:'(509) 555-0100'}}},Date,setTimeout:fn=>fn(),matchMedia:()=>({matches:false}),navigator:{clipboard:{writeText:async()=>{}}},location:{href:''}});
  await vm.runInContext(fs.readFileSync('live-demo.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],context);
  await elements.demoBtn.click();return {elements,requests,location:context.location};
}
test('closed demo explains unavailability after either token or number rejection without inviting repeated retries',async()=>{
  for(const options of [{tokenStatus:503},{revealStatus:503}]){const {elements,location}=await experience(options);assert.match(elements.demoStatus.textContent,/currently unavailable/);assert.doesNotMatch(elements.demoStatus.textContent,/try again/i);assert.equal(elements.demoFallback.hidden,false);assert.equal(elements.demoBtn.disabled,false);assert.equal(elements.demoBtn.dataset.state,undefined);assert.equal(location.href,'')}
});
test('rate limits and transport errors offer useful alternatives without exposing diagnostics or a number',async()=>{
  for(const options of [{tokenStatus:429},{revealStatus:429},{networkFailure:true}]){const {elements}=await experience(options);assert.match(elements.demoStatus.textContent,/explore the dashboard/);assert.doesNotMatch(elements.demoStatus.textContent,/private|try again/i);assert.equal(elements.demoFallback.hidden,false);assert.equal(elements.demoBtn.dataset.state,undefined)}
});
test('verified available demo still reveals the number normally',async()=>{const {elements,requests}=await experience();assert.equal(requests,2);assert.equal(elements.demoBtn.dataset.state,'revealed');assert.equal(elements.demoLabel.textContent,'(509) 555-0100');assert.equal(elements.demoStatus.textContent,'Demo number revealed.')});
