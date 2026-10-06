const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {renderCall}=require('../industry-experience');
const slugs=['home-services','medical','legal','property','automotive','professional-services'];
test('every industry has six complete distinct scenarios and its own image',()=>{
 const quotes=new Set();for(const slug of slugs){const html=fs.readFileSync(path.join(__dirname,'../industries',slug+'.html'),'utf8');const {calls}=JSON.parse(html.match(/<script type="application\/json" id="industry-data">([\s\S]*?)<\/script>/)[1]);assert.equal(calls.length,6);assert.equal(new Set(calls.map(c=>c.title)).size,6);assert.ok(html.includes('/assets/industries/'+slug+'.jpg'));for(const c of calls){assert.equal(c.fields.length,4);assert.ok(c.caller&&c.answer&&c.handoff);quotes.add(c.caller);assert.match(renderCall(c),/Sample call · not real customer data/);}}assert.equal(quotes.size,36);
});
test('call rendering treats caller and capture text as text, never executable markup',()=>{
 const html=renderCall({title:'<script>x</script>',caller:'<img src=x onerror=x>',answer:'"safe"',fields:[['<b>','<iframe>']],handoff:'<script>bad</script>'});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<iframe>'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;b&gt;'));
});
