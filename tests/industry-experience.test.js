const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const slugs=['home-services','medical','legal','property','automotive','professional-services'];
test('every industry exposes three situations without requiring script, selection or motion',()=>{
 const heroes=new Set();
 for(const slug of slugs){const html=fs.readFileSync(path.join(__dirname,'../industries',slug+'.html'),'utf8');heroes.add(html.match(/<h1>(.*?)<\/h1>/)[1]);
 assert.equal((html.match(/class="industry-moment"/g)||[]).length,3);assert.equal((html.match(/Your team stays in control/g)||[]).length,3);
 assert.ok(html.includes('id="call-types"'));assert.ok(html.includes('/assets/industries/'+slug+'.jpg'));
 assert.doesNotMatch(html,/data-story-scene|industry-story.js|CHOOSE A MOMENT|suitability review before activation|Talk to CallerCore/);
 }assert.equal(heroes.size,6);
});
test('simplified regulated pages preserve service boundaries',()=>{
 const medical=fs.readFileSync(path.join(__dirname,'../industries/medical.html'),'utf8');assert.match(medical,/Do not submit protected health information/);assert.match(medical,/No diagnosis, medical advice, emergency triage, or automatic booking/);assert.match(medical,/Staff confirms all appointments/);
 const legal=fs.readFileSync(path.join(__dirname,'../industries/legal.html'),'utf8');assert.match(legal,/legal advice/i);
});
