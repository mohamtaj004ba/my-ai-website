const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {renderScene}=require('../industry-story');
const slugs=['home-services','medical','legal','property','automotive','professional-services'];
test('industry pages replace transcripts with distinct business situations and keep existing anchors',()=>{
 const headlines=new Set();
 for(const slug of slugs){const html=fs.readFileSync(path.join(__dirname,'../industries',slug+'.html'),'utf8');const story=JSON.parse(html.match(/<script type="application\/json" id="industry-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(story.setting,slug);assert.equal(story.scenes.length,3);assert.equal(new Set(story.scenes.map(s=>s.title)).size,3);assert.ok(html.includes('id="call-types"'));assert.ok(html.includes('/assets/industries/'+slug+'.jpg'));assert.ok(!html.includes('call-transcript'));assert.ok(!html.includes('industry-experience.js'));assert.ok(html.includes('data-story-pause'));
  for(const scene of story.scenes){assert.equal(scene.calls.length,3);assert.ok(scene.handles&&scene.retains&&scene.outcome);headlines.add(scene.headline);assert.match(renderScene(scene,0,slug,story.place),/CALLERCORE TAKES ON/);assert.match(renderScene(scene,0,slug,story.place),/YOUR TEAM KEEPS/);}
 }assert.equal(headlines.size,18);
});
test('scene rendering escapes business content rather than inserting executable markup',()=>{
 const scene={period:'<script>x</script>',headline:'<img onerror=x>',pressure:'<iframe>',focus:'<script>',calls:['<img>','<b>','<a>'],handles:'<script>',retains:'<iframe>',outcome:'<script>'};const html=renderScene(scene,0,'medical','<img>');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<iframe>'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;b&gt;'));
});
test('motion can be paused, respects reduced motion, and never advances a situation on a timer',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../industry-story.js'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../industry-story.css'),'utf8');assert.match(js,/prefers-reduced-motion/);assert.match(js,/aria-pressed/);assert.match(css,/animation-play-state:paused/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.ok(!/setInterval|setTimeout/.test(js));
});
test('switching situations preserves pause and reduced-motion preference can stop a running scene',()=>{
 const vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../industries/medical.html'),'utf8');
 const story=JSON.parse(html.match(/<script type="application\/json" id="industry-data">([\s\S]*?)<\/script>/)[1]);
 const element=()=>({attrs:{},handlers:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.handlers[k]=fn}});
 const panel=element(),pause=element(),classes=new Set(),stage={classList:{toggle(k,on){on?classes.add(k):classes.delete(k)}}};
 const buttons=story.scenes.map((_,i)=>Object.assign(element(),{dataset:{storyScene:String(i)}}));
 const motion={matches:false,addEventListener(_,fn){this.changed=fn}};
 const window={document:{getElementById(id){return {'industry-data':{textContent:JSON.stringify(story)},'industry-scene':panel,'industry-story':stage}[id]},querySelector(){return pause},querySelectorAll(){return buttons}},matchMedia(q){return q.includes('reduced-motion')?motion:{matches:false}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../industry-story.js'),'utf8'),{window});
 pause.handlers.click();assert.equal(pause.attrs['aria-pressed'],'true');assert.ok(classes.has('story-paused'));
 buttons[1].handlers.click();assert.equal(buttons[1].attrs['aria-pressed'],'true');assert.equal(buttons[0].attrs['aria-pressed'],'false');assert.ok(panel.innerHTML.includes(story.scenes[1].headline));assert.ok(classes.has('story-paused'));
 pause.handlers.click();assert.equal(pause.attrs['aria-pressed'],'false');motion.changed({matches:true});assert.equal(pause.attrs['aria-pressed'],'true');assert.ok(classes.has('story-paused'));
});
