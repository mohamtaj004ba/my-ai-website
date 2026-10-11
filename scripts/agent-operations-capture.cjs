'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
async function capture(scope,{signal,executionId,outputDir='artifacts/agent-operations',bypassSecret}={}){
  if(!/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(scope.origin)||JSON.stringify(scope.paths)!==JSON.stringify(['/industries/legal','/#pricing']))throw new Error('Unapproved capture scope');
  if(!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(executionId))throw new Error('Invalid execution');
  const browserEnv=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','HOME','DISPLAY','XDG_RUNTIME_DIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,env:browserEnv,...(process.env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE?{executablePath:process.env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE}:{})});
  const abort=()=>browser.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  try{
    if(signal?.aborted)throw new Error('Cancelled');
    const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin!==scope.origin||req.method()!=='GET'||url.pathname.startsWith('/api/')||url.username||url.password)return route.abort();
      // Inject protection bypass only for this exact immutable origin.
      return route.continue({headers:{...req.headers(),...(bypassSecret?{'x-vercel-protection-bypass':bypassSecret}:{})}});
    });
    if(context.routeWebSocket)await context.routeWebSocket('**/*',ws=>ws.close());
    await fs.mkdir(outputDir,{recursive:true});const images=[];
    for(const routePath of scope.paths)for(const width of [1440,390]){
      if(signal?.aborted)throw new Error('Cancelled');
      const page=await context.newPage();await page.setViewportSize({width,height:1000});
      const response=await page.goto(scope.origin+routePath,{waitUntil:'networkidle',timeout:20000});
      if(!response?.ok()||new URL(page.url()).origin!==scope.origin)throw new Error('Preview render unavailable');
      // Locate the known dashboard/pricing proof area, not an agent-provided selector.
      const selector=routePath==='/#pricing'?'#pricing article.featured':'.legal-proof .proof-figure';
      const target=page.locator(selector).first();if(!await target.count())throw new Error('Required visual target missing');await target.scrollIntoViewIfNeeded();
      const image=target.locator('img');if(await image.count())await image.first().evaluate(img=>img.decode());
      await page.emulateMedia({reducedMotion:'reduce'});
      const bytes=await page.screenshot({animations:'disabled',fullPage:false});
      const name=executionId+'-'+(routePath==='/#pricing'?'pricing':'legal')+'-'+width+'.png';
      await fs.writeFile(path.join(outputDir,name),bytes,{flag:'wx'});
      images.push({path:name,viewport:width,sha256:createHash('sha256').update(bytes).digest('hex'),dataUrl:'data:image/png;base64,'+bytes.toString('base64')});await page.close();
    }
    return images;
  }finally{signal?.removeEventListener('abort',abort);await browser.close();}
}
module.exports={capture};
