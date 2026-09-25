import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL=String(process.env.PREVIEW_URL||'').replace(/\/$/,'');
const secret=String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'');
const qaEmail=String(process.env.CALLERCORE_QA_EMAIL||'preview-qa@callercore.test').trim().toLowerCase();
if(!baseURL)throw new Error('PREVIEW_URL is required');
const parsed=new URL(baseURL);
if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.vercel.app'))throw new Error('Authenticated QA only runs against protected Vercel Preview URLs');
if(!secret)throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required');

const outDir=path.resolve('qa-artifacts');
await fs.mkdir(outDir,{recursive:true});
const report={
  previewUrl:baseURL,
  startedAt:new Date().toISOString(),
  client:{views:[]},
  admin:{views:[]},
  consoleErrors:[],
  pageErrors:[],
  apiErrors:[]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:1440,height:1100},
  extraHTTPHeaders:{
    'x-vercel-protection-bypass':secret,
    'x-vercel-set-bypass-cookie':'true'
  }
});
const page=await context.newPage();

page.on('console',msg=>{
  if(msg.type()==='error')report.consoleErrors.push(msg.text().slice(0,1000));
});
page.on('pageerror',err=>report.pageErrors.push(String(err?.message||err).slice(0,1000)));
page.on('response',res=>{
  try{
    const u=new URL(res.url());
    if(u.origin===parsed.origin&&u.pathname.startsWith('/api/')&&res.status()>=400){
      report.apiErrors.push({status:res.status(),url:u.pathname+u.search});
    }
  }catch{}
});

const api=context.request;
const qaHeaders={
  'content-type':'application/json',
  'x-bootstrap-secret':secret,
  'x-qa-secret':secret
};

async function post(action,data){
  const res=await api.post(baseURL+'/api/account?action='+encodeURIComponent(action),{
    headers:qaHeaders,
    data
  });
  const text=await res.text();
  let body={};
  try{body=text?JSON.parse(text):{}}catch{}
  if(!res.ok())throw new Error(action+' failed ('+res.status()+'): '+String(body.error||text||'unknown error').slice(0,500));
  return body;
}

async function gotoAuthed(route,requiredSelector){
  const res=await page.goto(baseURL+route,{waitUntil:'domcontentloaded',timeout:30000});
  if(!res||!res.ok())throw new Error(route+' returned '+(res?res.status():'no response'));
  await page.waitForSelector(requiredSelector,{timeout:20000});
  await page.waitForLoadState('networkidle',{timeout:10000}).catch(()=>{});
  await page.waitForTimeout(1200);
  const body=await page.locator('body').innerText();
  if(/sign in to callercore|authentication required/i.test(body))throw new Error(route+' rendered an authentication screen');
}

async function sweepViews(kind){
  const selector='button.nav-item[data-view]';
  const views=await page.locator(selector).evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('data-view')).filter(Boolean))]);
  for(const view of views){
    const button=page.locator(selector+'[data-view="'+view+'"]').first();
    await button.click();
    await page.waitForTimeout(450);
    const active=await button.evaluate(el=>el.classList.contains('active'));
    if(!active)throw new Error(kind+' navigation did not activate '+view);
    const file=kind+'-'+view.replace(/[^a-z0-9_-]+/gi,'-')+'.png';
    await page.screenshot({path:path.join(outDir,file),fullPage:true});
    report[kind].views.push(view);
  }
}

try{
  const launcher=await page.goto(baseURL+'/api/preview-e2e',{waitUntil:'domcontentloaded',timeout:30000});
  if(!launcher||!launcher.ok())throw new Error('Preview launcher returned '+(launcher?launcher.status():'no response'));
  await page.waitForSelector('#create',{timeout:10000});

  const boot=await post('bootstrap-preview',{email:qaEmail,businessName:'Summit Heating & Air',plan:'Pro'});
  report.workspaceId=boot.workspaceId||'';
  report.workspaceReused=!!boot.reused;

  const seed=await post('seed-preview-data',{email:qaEmail});
  report.seed={calls:seed.calls,leads:seed.leads,conversations:seed.conversations,adminClients:seed.adminClients,days:seed.days};

  const client=await post('preview-session',{email:qaEmail,mode:'client'});
  if(client.redirect!=='/dashboard')throw new Error('Unexpected client redirect');
  await gotoAuthed('/dashboard','button.nav-item[data-view="overview"]');
  await page.screenshot({path:path.join(outDir,'client-overview-initial.png'),fullPage:true});
  await sweepViews('client');

  const admin=await post('preview-session',{email:qaEmail,mode:'admin'});
  if(admin.redirect!=='/admin-dashboard')throw new Error('Unexpected admin redirect');
  await gotoAuthed('/admin-dashboard','button.nav-item[data-view="overview"]');
  await page.screenshot({path:path.join(outDir,'admin-overview-initial.png'),fullPage:true});
  await sweepViews('admin');

  await page.waitForTimeout(500);
  const seriousApi=report.apiErrors.filter(x=>![401,404].includes(x.status));
  if(report.pageErrors.length)throw new Error('Page errors: '+report.pageErrors.join(' | '));
  if(report.consoleErrors.length)throw new Error('Console errors: '+report.consoleErrors.join(' | '));
  if(seriousApi.length)throw new Error('API errors: '+JSON.stringify(seriousApi));

  report.ok=true;
}catch(err){
  report.ok=false;
  report.failure=String(err?.stack||err);
  try{await page.screenshot({path:path.join(outDir,'failure.png'),fullPage:true})}catch{}
  throw err;
}finally{
  report.finishedAt=new Date().toISOString();
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
