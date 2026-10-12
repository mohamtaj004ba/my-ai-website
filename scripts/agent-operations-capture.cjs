'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {ORIGIN,previewTransport,offlineFonts}=require('./agent-operations-preview-access.cjs');
async function capture(scope,{signal,executionId,outputDir='artifacts/agent-operations',oidcToken,collectGeometry=false,workflowId}={}){
  if(scope.origin!==ORIGIN||scope.commit!=='8133597ff2fc5b48e3de42336e9e06fa4191c2a8'||JSON.stringify(scope.paths)!==JSON.stringify(['/industries/legal','/#pricing']))throw new Error('Unapproved capture scope');
  if(!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(executionId))throw new Error('Invalid execution');
  if(collectGeometry&&!/^wf_[a-f0-9]{32}$/.test(workflowId||''))throw new Error('Geometry task binding required');
  const transport=previewTransport({token:oidcToken,signal});
  const fonts=offlineFonts();
  const browserEnv=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','HOME','DISPLAY','XDG_RUNTIME_DIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,env:browserEnv,...(process.env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE?{executablePath:process.env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE}:{})});
  const abort=()=>browser.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  try{
    if(signal?.aborted)throw new Error('Cancelled');
    const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    await context.route('**/*',async route=>{
      const req=route.request();
      // Trusted Node transport holds the identity; browser and model never receive it.
      if(req.isNavigationRequest()&&req.frame().parentFrame())return route.abort();
      const request={url:req.url(),method:req.method(),type:req.resourceType()};
      try{return await route.fulfill(fonts(request)||await transport(request));}
      catch{return route.abort();}
    });
    if(context.routeWebSocket)await context.routeWebSocket('**/*',ws=>ws.close());
    await fs.mkdir(outputDir,{recursive:true});const images=[],geometryRows=[],measurements=[];
    for(const routePath of scope.paths)for(const width of [1440,390]){
      if(signal?.aborted)throw new Error('Cancelled');
      const page=await context.newPage();await page.setViewportSize({width,height:1000});
      const response=await page.goto(scope.origin+routePath,{waitUntil:'networkidle',timeout:20000});
      if(!response?.ok()||page.url()!==scope.origin+routePath)throw new Error('Preview render unavailable');
      const fontReady=await page.evaluate(async()=>{await Promise.all(['400 12px "DM Sans"','700 12px "Manrope"'].map(f=>document.fonts.load(f)));await document.fonts.ready;return ['DM Sans','Manrope'].every(f=>Array.from(document.fonts).some(x=>x.family.replace(/["']/g,'')===f&&x.status==='loaded'));});
      if(!fontReady)throw new Error('Required Preview typography unavailable');
      // Locate the known dashboard/pricing proof area, not an agent-provided selector.
      const selector=routePath==='/#pricing'?'#pricing article.featured':'.legal-proof .proof-figure';
      const target=page.locator(selector).first();if(!await target.count())throw new Error('Required visual target missing');await target.scrollIntoViewIfNeeded();
      const image=target.locator('img');if(await image.count())await image.first().evaluate(img=>img.decode());
      await page.emulateMedia({reducedMotion:'reduce'});
      if(collectGeometry&&routePath==='/#pricing'){const g=await require('./agent-operations-capture-geometry.cjs').measure(page);geometryRows.push({imageId:'I'+(images.length+1),headingOverlap:g.headingOverlap,priceOverlap:g.priceOverlap,priceGap:g.priceGap});measurements.push({imageId:'I'+(images.length+1),samples:g.samples});}
      const bytes=await page.screenshot({animations:'disabled',fullPage:false});
      const name=executionId+'-'+(routePath==='/#pricing'?'pricing':'legal')+'-'+width+'.png';
      await fs.writeFile(path.join(outputDir,name),bytes,{flag:'wx'});
      images.push({path:name,viewport:width,sha256:createHash('sha256').update(bytes).digest('hex'),capturedAt:Date.now(),dataUrl:'data:image/png;base64,'+bytes.toString('base64')});await page.close();
    }
    return collectGeometry?{images,geometry:{workflowId,executionId,sourceCommit:scope.commit,provenance:'capture-time',results:geometryRows,measurements}}:images;
  }finally{signal?.removeEventListener('abort',abort);await browser.close();}
}
module.exports={capture};
