'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {SOURCE,OFFLINE_ORIGIN,localResource,stable,validateSamples}=require('../scripts/agent-operations-geometry-check.cjs');
const record=require('../data/agent-operations-reproduction-geometry.json');
const samples=()=>[0,1,2].map(()=>{const r=structuredClone(record.results[0]);r.fontCheck=true;for(const k of ['badge','heading','price'])r[k].count=1;return r;});
test('capture-time collector waits for fonts at final scroll position before three stable geometry samples',async()=>{const calls=[],s=samples(),page={evaluate:async fn=>{calls.push(String(fn).includes('document.fonts.load')?'fonts-ready':'animation-frame');},locator:()=>({evaluate:async()=>{calls.push('sample');return s.shift();}})};const result=await require('../scripts/agent-operations-capture-geometry.cjs').measure(page);assert.equal(calls[0],'fonts-ready');assert.deepEqual(calls.slice(1),['animation-frame','sample','animation-frame','sample','animation-frame','sample']);assert.equal(result.samples.length,3);assert.equal(result.headingOverlap,true);assert.equal(result.priceOverlap,false);assert(result.priceGap>0);});
test('offline collector serves only exact approved Git resource paths from synthetic origin',()=>{
 const read=[],options={fonts:()=>null,read:file=>{read.push(file);return Buffer.from('offline test data');}};
 const r=localResource({url:OFFLINE_ORIGIN+'/',method:'GET',type:'document'},options);assert.equal(r.status,200);assert.equal(r.contentType,'text/html');assert.deepEqual(read,['index.html']);assert.equal(SOURCE,record.source);
 for(const request of [{url:'https://example.com/'},{url:OFFLINE_ORIGIN+'/api/agent-operations'},{url:OFFLINE_ORIGIN+'/?scope=all'},{url:OFFLINE_ORIGIN+'/%2e%2e/secrets'},{url:OFFLINE_ORIGIN+'/redesign.css',method:'POST',type:'stylesheet'},{url:OFFLINE_ORIGIN+'/',type:'fetch'},{url:OFFLINE_ORIGIN+'/industries/healthcare'},{url:OFFLINE_ORIGIN+'/#pricing'},{url:'https://user:password@callercore-offline-geometry.invalid/'}])assert.equal(localResource({method:'GET',type:'document',...request},options),null);
 assert.deepEqual(read,['index.html']);
});
test('only hash-verified font handler may fulfill font resources; no general network fallback',()=>{
 let reads=0;const known={status:200,contentType:'font/woff2',body:Buffer.from('verified local font')};const fonts=request=>request.url==='https://known-font.invalid/font.woff2'&&request.type==='font'&&request.method==='GET'?known:null;
 const options={fonts,read:()=>{reads++;throw Error('Denied');}};
 assert.equal(localResource({url:'https://known-font.invalid/font.woff2',type:'font',method:'GET'},options),known);
 assert.equal(localResource({url:'https://unknown-font.invalid/font.woff2',type:'font',method:'GET'},options),null);assert.equal(reads,0);
});
test('browser samples require unique selectors, loaded fonts, visible finite geometry and explicit DPR',()=>{
 assert.deepEqual(validateSamples(samples()),{stable:true,samples:3,toleranceCssPixels:.1});
 for(const mutate of [r=>r.fontsLoaded=false,r=>r.fontCheck=false,r=>r.viewport.dpr=2,r=>r.heading.count=2,r=>r.badge.box.width=NaN,r=>r.price.textRects=[],r=>r.price.style.opacity='0',r=>r.heading.style.visibility='hidden']){const s=samples();mutate(s[1]);assert.throws(()=>validateSamples(s),/unconfirmed/);}
});
test('changing scroll, boxes, text, glyph boxes or styles between frames fails stability rather than inventing a reliable result',()=>{
 for(const mutate of [r=>r.viewport.scrollY++,r=>{r.heading.box.y++;r.heading.box.bottom++;},r=>r.heading.text='Starter',r=>r.price.style.fontSize='10px',r=>{r.badge.textRects[0].x++;r.badge.textRects[0].right++;}]){const s=samples();mutate(s[2]);assert.throws(()=>validateSamples(s),/changed/);}
 assert.throws(()=>validateSamples(samples().slice(0,2)),/unconfirmed/);
});
test('stability tolerance compares finite internally consistent rectangles and does not certify painted occlusion',()=>{
 const r=record.results[0].badge.box;assert(stable(r,{...r,x:r.x+.05,right:r.right+.05}));assert(!stable(r,{...r,x:r.x+1,right:r.right+1}));assert(!stable(r,{...r,width:-1}));assert(!stable(r,{...r,bottom:Infinity}));
});
