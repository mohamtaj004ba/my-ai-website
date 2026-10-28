// Focused presentation QA. Full authenticated QA remains mandatory for STRICT changes.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {previewRequestHeaders} from './preview-request-headers.mjs';
const require=createRequire(import.meta.url),selection=require('./development-verification.cjs').plan(process.env.QUALITY_BASE);
if(selection.lane==='STRICT'||selection.docsOnly||!selection.pages.length)throw Error('Exact affected presentation selection required');
const pin=JSON.parse(await fs.readFile('qa-artifacts/release-pin.json','utf8')).result;
if(!pin||pin.checkpoint!==selection.head||pin.release?.digest!==require('../lib/agent-operations-contracts').assertRelease().digest)throw Error('Fresh exact release pin required');
if(!/^https:\/\/my-ai-website-[a-z0-9-]+\.vercel\.app$/.test(pin.url)||!process.env.VERCEL_AUTOMATION_BYPASS_SECRET)throw Error('Protected Preview required');
const report={version:'affected-public-qa-v1',selection,previewUrl:pin.url,startedAt:new Date().toISOString(),checks:[],errors:[],modelRequests:0,fullVisualVerification:false};
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route=>route.continue({headers:previewRequestHeaders(route.request().url(),{...route.request().headers(),'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET},pin.url)}));
  try{const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e.message).slice(0,200)));
   page.on('console',msg=>{if(msg.type()==='error')report.errors.push('Console: '+msg.text().slice(0,200));});
   page.on('response',response=>{if(new URL(response.url()).origin===new URL(pin.url).origin&&response.status()>=400)report.errors.push('HTTP '+response.status()+' '+new URL(response.url()).pathname);});
   for(const file of selection.pages){
    const route=file==='index.html'?'/':'/'+file.replace(/\.html$/,'');
    const response=await page.goto(pin.url+route,{waitUntil:'networkidle',timeout:30000});
    if(!response?.ok())throw Error('Affected page unavailable');
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title,body:document.body.innerText.trim().length}));
    if(geometry.scroll>width+1||!geometry.title||geometry.body<20)throw Error('Affected page layout/content failed');
    const screenshot='affected-'+file.replace(/[^a-z0-9]/gi,'-')+'-'+width+'.png';
    await page.screenshot({path:'qa-artifacts/'+screenshot,fullPage:true});report.checks.push({file,width,screenshot,geometry});
   }
  }finally{await context.close();}
 }
 if(report.errors.length)throw Error('Affected page errors');report.ok=true;
}finally{await browser.close();report.finishedAt=new Date().toISOString();await fs.writeFile('qa-artifacts/affected-report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({affectedPublicQa:'passed',checks:report.checks.length,fullVisualVerification:false}));
