'use strict';
// Offline, read-only reproduction. No hosted navigation, credential lookup, capture or model request.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {ORIGIN,allowed,offlineFonts}=require('./agent-operations-preview-access.cjs');
const {validRect,relation}=require('../lib/agent-operations-geometry');
const SOURCE='8133597ff2fc5b48e3de42336e9e06fa4191c2a8',OFFLINE_ORIGIN='https://callercore-offline-geometry.invalid';
const SELECTORS=Object.freeze({card:'#pricing article.featured',badge:'.badge',heading:'p',price:'h3'});
const sha=body=>crypto.createHash('sha256').update(body).digest('hex');
function localResource(request,{fonts,read}){
 const font=fonts(request);if(font)return font;
 let u;try{u=new URL(request.url);}catch{return null;}
 if(u.origin!==OFFLINE_ORIGIN||u.username||u.password||u.search||u.hash||/%|\\/.test(request.url)||!allowed(ORIGIN+u.pathname,request.method,request.type))return null;
 const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
 const body=read(file);if(!Buffer.isBuffer(body)||body.length>5000000)throw Error('Offline resource unconfirmed');
 return{status:200,contentType:({'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream',body};
}
function stable(a,b,tolerance=.1){return validRect(a)&&validRect(b)&&['x','y','width','height','right','bottom'].every(k=>Math.abs(a[k]-b[k])<=tolerance);}
function validateSamples(samples){
 if(!Array.isArray(samples)||samples.length!==3)throw Error('Geometry stability unconfirmed');
 for(const sample of samples){
  if(!sample.fontsLoaded||!sample.fontCheck||![1440,390].includes(sample.viewport.width)||sample.viewport.height!==1000||sample.viewport.dpr!==1||!Number.isFinite(sample.viewport.scrollY)||!validRect(sample.card))throw Error('Geometry prerequisites unconfirmed');
  for(const object of ['badge','heading','price'])if(sample[object]?.count!==1||!validRect(sample[object].box)||!sample[object].text.trim()||!sample[object].textRects.length||sample[object].textRects.some(r=>!validRect(r))||sample[object].style.visibility!=='visible'||sample[object].style.opacity!=='1')throw Error('Geometry selector evidence unconfirmed');
 }
 for(const sample of samples.slice(1)){if(JSON.stringify(sample.viewport)!==JSON.stringify(samples[0].viewport)||!stable(sample.card,samples[0].card)||['badge','heading','price'].some(k=>!stable(sample[k].box,samples[0][k].box)||sample[k].text!==samples[0][k].text||JSON.stringify(sample[k].style)!==JSON.stringify(samples[0][k].style)||sample[k].textRects.length!==samples[0][k].textRects.length||sample[k].textRects.some((r,i)=>!stable(r,samples[0][k].textRects[i]))))throw Error('Geometry changed between samples');}
 return{stable:true,samples:3,toleranceCssPixels:.1};
}
function playwright(){try{return require('playwright');}catch{return require(path.resolve(__dirname,'../../callercore/node_modules/playwright'));}}
async function collect({chromium=playwright().chromium}={}){
 const repo=path.resolve(__dirname,'..'),cache=new Map(),fonts=offlineFonts(),blocked=[],results=[];let fulfilled=0;
 const read=file=>{if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',SOURCE+':'+file],{cwd:repo,maxBuffer:5000000,windowsHide:true}));return cache.get(file);};
 assert.equal(cp.execFileSync('git',['rev-parse',SOURCE+'^{commit}'],{cwd:repo,encoding:'utf8',windowsHide:true}).trim(),SOURCE);
 const env=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const executable='C:/Program Files/Google/Chrome/Application/chrome.exe';
 const browser=await chromium.launch({headless:true,env,...(fs.existsSync(executable)?{executablePath:executable}:{}),args:['--disable-background-networking','--disable-component-update']});
 try{
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false,deviceScaleFactor:1,offline:true});
  await context.route('**/*',async route=>{const q=route.request();if(fulfilled+blocked.length>=256){blocked.push({reason:'resource-limit'});return route.abort();}try{const response=localResource({url:q.url(),method:q.method(),type:q.resourceType()},{fonts,read});if(response){fulfilled++;return route.fulfill(response);}}catch{/* Missing/unverified Git or font resource fails closed. */}blocked.push({type:q.resourceType(),reason:'not-offline-allowlisted'});return route.abort();});
  if(context.routeWebSocket)await context.routeWebSocket('**/*',ws=>ws.close());
  for(const width of [1440,390]){
   const page=await context.newPage();await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
   await page.goto(OFFLINE_ORIGIN+'/#pricing',{waitUntil:'networkidle',timeout:30000});
   await page.evaluate(async()=>{await Promise.all(['400 12px "DM Sans"','700 12px "Manrope"'].map(f=>document.fonts.load(f)));await document.fonts.ready;});
   assert.equal(await page.locator(SELECTORS.card).count(),1);await page.locator(SELECTORS.card).scrollIntoViewIfNeeded();
   const samples=[];
   for(let n=0;n<3;n++){
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    samples.push(await page.locator(SELECTORS.card).evaluate((card,selectors)=>{
     const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom});
     const measure=selector=>{const matches=card.querySelectorAll(selector);if(matches.length!==1)throw Error('Selector is not unique');const e=matches[0],s=getComputedStyle(e),range=document.createRange();range.selectNodeContents(e);return{selector,count:matches.length,text:e.textContent.trim(),box:rect(e.getBoundingClientRect()),textRects:[...range.getClientRects()].map(rect),style:{position:s.position,zIndex:s.zIndex,fontFamily:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,opacity:s.opacity,visibility:s.visibility,transform:s.transform,overflow:s.overflow}};};
     return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollY},card:rect(card.getBoundingClientRect()),badge:measure(selectors.badge),heading:measure(selectors.heading),price:measure(selectors.price),fontsLoaded:['DM Sans','Manrope'].every(f=>Array.from(document.fonts).some(x=>x.family.replace(/["']/g,'')===f&&x.status==='loaded')),fontCheck:['400 12px "DM Sans"','700 12px "Manrope"'].every(f=>document.fonts.check(f))};
    },SELECTORS));
   }
   const stability=validateSamples(samples),r=samples[0];assert.equal(r.badge.text,'Built to grow');assert.equal(r.heading.text,'Growth');assert.equal(r.price.text.replace(/\s/g,''),'$599/mo');
   results.push({...r,stability,sampleHashes:samples.map(s=>sha(JSON.stringify(s))),headingRelation:relation(r.badge.box,r.heading.box),priceRelation:relation(r.badge.box,r.price.box)});await page.close();
  }
  const report={version:1,kind:'OFFLINE replay geometry, not original capture-time DOM evidence',provenance:'reproduction-only',originalCaptureGeometry:'unavailable',source:SOURCE,observedAt:new Date().toISOString(),browserVersion:browser.version(),navigationOrigin:OFFLINE_ORIGIN,modelCalls:0,externalNetworkRequests:0,screenshotCaptures:0,localResourcesFulfilled:fulfilled,blockedRequests:blocked,selectors:SELECTORS,fontManifestHash:sha(fs.readFileSync(path.join(__dirname,'agent-operations-fonts/manifest.json'))),files:[...cache].map(([file,body])=>({file,sha256:sha(body)})),results,limitations:['Measurements were newly reproduced offline and are not original capture-time evidence.','Browser version, font rasterization and scroll/timing can differ from historical PNGs.','Bounding-box intersections do not prove painted glyph occlusion or image accuracy; independent original-image review remains required.']};
  report.recordHash=sha(JSON.stringify(report));return report;
 }finally{await browser.close();}
}
if(require.main===module)collect().then(report=>{
 const target=path.resolve(__dirname,'../artifacts/agent-operations/hybrid-geometry-reproduction.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output:target,source:report.source,recordHash:report.recordHash,modelCalls:0,externalNetworkRequests:0,screenshotCaptures:0,results:report.results.map(r=>({width:r.viewport.width,stable:r.stability.stable,headingIntersection:r.headingRelation.intersectionHeight,priceIntersection:r.priceRelation.intersectionHeight,gap:r.priceRelation.verticalGap}))}));
}).catch(()=>{console.error('Offline geometry verification failed; no hosted or paid request was attempted.');process.exitCode=1;});
module.exports={SOURCE,OFFLINE_ORIGIN,SELECTORS,localResource,stable,validateSamples,collect};
