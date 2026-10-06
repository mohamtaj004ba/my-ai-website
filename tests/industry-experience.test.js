const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {renderCall}=require('../industry-experience');
const slugs=['home-services','medical','legal','property','automotive','professional-services'];
test('every industry has six complete distinct scenarios and its own image',()=>{
 const quotes=new Set();for(const slug of slugs){const html=fs.readFileSync(path.join(__dirname,'../industries',slug+'.html'),'utf8');const {calls}=JSON.parse(html.match(/<script type="application\/json" id="industry-data">([\s\S]*?)<\/script>/)[1]);assert.equal(calls.length,6);assert.equal(new Set(calls.map(c=>c.title)).size,6);assert.ok(html.includes('/assets/industries/'+slug+'.jpg'));for(const c of calls){assert.equal(c.fields.length,4);assert.ok(c.caller&&c.answer&&c.handoff);quotes.add(c.caller);assert.match(renderCall(c),/Sample call · not real customer data/);}}assert.equal(quotes.size,36);
});
test('call rendering treats caller and capture text as text, never executable markup',()=>{
 const html=renderCall({title:'<script>x</script>',caller:'<img src=x onerror=x>',answer:'"safe"',fields:[['<b>','<iframe>']],handoff:'<script>bad</script>'});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<iframe>'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;b&gt;'));
});
test('all industry examples have a complete conversation and matching outcome',()=>{
 const replies=new Set();let resolved=0;
 for(const slug of slugs){
  const html=fs.readFileSync(path.join(__dirname,'../industries',slug+'.html'),'utf8');
  const {calls}=JSON.parse(html.match(/<script type="application\/json" id="industry-data">([\s\S]*?)<\/script>/)[1]);
  for(const call of calls){
   assert.ok(call.context&&call.turns.length>=8,slug+': '+call.title);
   call.turns.forEach((turn,i)=>{assert.equal(turn.speaker,i%2?'caller':'receptionist');assert.ok(turn.text.length>8);});
   assert.equal(call.turns.at(-1).speaker,'receptionist');
   assert.ok(!call.turns.some(t=>/your (?:practice|firm|shop).*approved|I can share.*approved/i.test(t.text)));
   const rendered=renderCall(call);assert.match(rendered,/Read full conversation/);assert.match(rendered,/Business details and policies are fictional examples/);
   if(call.resolved){resolved++;assert.match(rendered,/Resolved without a callback/);}else assert.match(rendered,/A focused next step for your team/);
   replies.add(call.turns[2].text);
  }
 }
 assert.equal(replies.size,36);assert.ok(resolved>=9);
});
test('full transcript text and example context are escaped',()=>{
 const rendered=renderCall({title:'Test',context:'<img onerror=x>',turns:[{speaker:'receptionist',text:'<script>alert(1)</script>'}],fields:[],handoff:'Done',resolved:true});
 assert.ok(!rendered.includes('<script>'));assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(rendered.includes('&lt;img'));
});
