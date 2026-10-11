'use strict';
// Local browser harness: real UI/API/store, mock authentication and model adapter.
// Not a hosted Preview or owner visual-acceptance claim.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createStore}=require('../lib/agent-operations-store'),{sqliteAdapter}=require('./agent-operations-sqlite.cjs');
const {createHandler}=require('../lib/agent-operations-api'),{runStage,mockAdapter}=require('../lib/agent-operations-worker');
async function main(){
  const out=path.resolve('artifacts/agent-operations/browser');await fs.mkdir(out,{recursive:true});
  const db=sqliteAdapter(path.join(out,'verification-'+Date.now()+'.sqlite'));
  const store=createStore(db,{scope:{origin:'https://fixture.vercel.app',commit:'a'.repeat(40)}}),env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true'};
  const handler=createHandler({env,store,getSession:async()=>({email:'fixture-admin@example.test',workspaceId:'internal'}),getMember:async()=>({role:'admin',workspaceId:'internal'}),rateLimit:async()=>({limited:false})});
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/agent-operations'){
        const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString();req.body=raw?JSON.parse(raw):undefined;req.query={};
        res.status=n=>{res.statusCode=n;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res;};return handler(req,res);
      }
      let file=url.pathname==='/'?'admin-dashboard.html':url.pathname.slice(1);
      if(!['admin-dashboard.html','agent-operations.js','agent-operations.css','dashboard.css','logo-icon.png'].includes(file)){res.statusCode=404;return res.end();}
      let content=await fs.readFile(path.resolve(file));
      if(file==='admin-dashboard.html'){
        content=content.toString().replace(/<script src="\/(?!agent-operations\.js)[^"]+"><\/script>/g,'').replace('<section class="view" id="view-agent-operations"','<section class="view active" id="view-agent-operations"').replace('<section class="view active" id="view-overview"','<section class="view" id="view-overview"');
      }
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(content);
    }catch{res.statusCode=500;res.end('Local fixture unavailable');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browserEnv=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','HOME','DISPLAY','XDG_RUNTIME_DIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,env:browserEnv,...(process.env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE?{executablePath:process.env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE}:{})});
  const errors=[];
  try{
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('#agentOpsRefresh').click();await page.locator('#agentOpsCreate').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.getElementById('agentOpsCreate').disabled);
    await page.locator('#agentOpsObjective').fill('<img src=x onerror=alert(1)> Inspect synthetic imagery');await page.locator('#agentOpsCreate').click();
    await page.waitForFunction(()=>document.querySelector('#agentOpsTasks h3'));
    assert.equal(await page.locator('#agentOpsTasks h3 img').count(),0);
    const task=(await store.read()).tasks[0];for(let i=0;i<4;i++)await runStage(store,mockAdapter(),{taskId:task.id});
    await page.locator('#agentOpsRefresh').click();await page.waitForFunction(()=>document.getElementById('agentOpsTasks').textContent.includes('verified'));
    const before=await db.read(),state=JSON.parse(before);state.tasks.find(t=>t.id===task.id).outcomes={structural:'passed',integrity:'passed',substantive:'failed',finalAcceptance:'rejected',acceptedWork:false};await db.compare(before,JSON.stringify(state));await page.locator('#agentOpsRefresh').click();await page.waitForFunction(()=>document.getElementById('agentOpsTasks').textContent.includes('Accuracy: failed'));assert((await page.locator('#agentOpsTasks').textContent()).includes('Final acceptance: rejected'));
    await page.locator('#agentOpsObjective').fill('Cancellation fixture');await page.locator('#agentOpsCreate').click();
    await page.getByRole('button',{name:'Cancel task',exact:true}).click();await page.waitForFunction(()=>document.getElementById('agentOpsTasks').textContent.includes('cancelled'));
    const layouts=[];
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:1000});
      await page.evaluate(()=>window.scrollTo(0,0));
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,'Overflow at '+width);
      await page.screenshot({path:path.join(out,'admin-'+width+'.png'),fullPage:true});layouts.push({width,overflow});
    }
    env.CALLERCORE_AGENTOPS_ENABLED='false';await page.locator('#agentOpsRefresh').click();await page.waitForFunction(()=>document.getElementById('agentOpsStatus').textContent.includes('disabled'));
    assert.equal(await page.locator('#agentOpsCreate').isDisabled(),true);assert.deepEqual(errors,[]);
    const report={ok:true,scope:'local real UI/API/SQLite with mock auth/models',layouts,tests:['persisted queue','four-stage mock delegation','independent review','cancel','escaped output','separate failed acceptance display','disabled gate'],taskId:task.id,apiCalls:0,pageErrors:errors};
    await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report)+'\n');
  }finally{await browser.close();await new Promise(r=>server.close(r));db.close();}
}
main().catch(e=>{process.stderr.write(String(e.message)+'\n');process.exitCode=1;});
