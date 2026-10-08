const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const slugs=['home-services','medical','legal','property','automotive','professional-services'];
test('industry narratives preserve photographic heroes and have six different story devices',()=>{
 const devices=['call-timeline','qualification-funnel','visit-journey','service-queue','routing-path','legal-gate'];
 const ordered=['home-services','professional-services','medical','automotive','property','legal'];
 for(const slug of slugs){const html=fs.readFileSync(path.join(__dirname,'../industries',slug+'.html'),'utf8');
 assert.ok(html.includes('class="'+devices[ordered.indexOf(slug)]+'"'));
 assert.doesNotMatch(html,/industry-moment|industry-settings-grid|industry-day-section/);
 assert.ok(html.includes('id="call-types"'));assert.ok(html.includes('/assets/industries/'+slug+'.jpg'));
 assert.equal((html.match(/src="\/industry-narratives.js"/g)||[]).length,1);
 assert.doesNotMatch(html,/data-story-scene|industry-story.js|CHOOSE A MOMENT|suitability review before activation|Talk to CallerCore/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
 for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(match[1]),slug+' anchor '+match[1]);
 }
});
test('simplified regulated pages preserve service boundaries',()=>{
 const medical=fs.readFileSync(path.join(__dirname,'../industries/medical.html'),'utf8');assert.match(medical,/Do not submit protected health information/);assert.match(medical,/No diagnosis, medical advice, emergency triage, or automatic booking/);assert.match(medical,/Staff confirms all appointments/);
 const legal=fs.readFileSync(path.join(__dirname,'../industries/legal.html'),'utf8');assert.match(legal,/legal advice/i);
});
