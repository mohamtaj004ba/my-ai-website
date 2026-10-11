'use strict';
const ORIGIN='https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app';
function offlineFonts(){
  const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
  const dir=path.join(__dirname,'agent-operations-fonts'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  const read=(file,sha)=>{if(!/^(?:fonts\.css|[a-f0-9]{64}\.(?:ttf|woff2))$/.test(file))throw new Error('Invalid font artifact');const body=fs.readFileSync(path.join(dir,file));if(body.length>500000||createHash('sha256').update(body).digest('hex')!==sha)throw new Error('Font artifact unconfirmed');return body;};
  const css=read('fonts.css',manifest.cssSha256),fonts=new Map(manifest.fonts.map(f=>[ORIGIN+'/__agentops_fonts/'+f.file,{status:200,contentType:f.file.endsWith('.woff2')?'font/woff2':'font/ttf',body:read(f.file,f.sha256)}]));
  // The original stylesheet URL is fulfilled offline. No external fetch or Vercel identity is involved.
  return ({url,method,type})=>method!=='GET'?null:url===manifest.cssUrl&&type==='stylesheet'?{status:200,contentType:'text/css',body:css}:type==='font'?fonts.get(url)||null:null;
}
const ASSETS=new Set([
  '/logo-icon.png','/redesign.css','/public-premium.css','/home-motion.css','/hero-film.css',
  '/dashboard-showcase.css','/industries.css','/homepage-imagery.css','/industry-platform.css',
  '/industry-narratives.css','/industry-refinement.css','/public-experience.js','/dashboard-showcase.js',
  '/hero-film.js','/site.js','/industries.js','/industry-narratives.js',
  '/assets/industries/legal.jpg','/assets/workspaces/after-hours.jpg','/assets/workspaces/work-in-progress.jpg',
  '/assets/workspaces/clear-next-step.jpg','/assets/dashboard/today-sample.jpg','/assets/dashboard/calls-sample.jpg',
  '/assets/dashboard/contacts-sample.jpg','/assets/dashboard/follow-ups-sample.jpg'
]);
function allowed(url,method,type){
  try{
    const u=new URL(url);
    if(u.origin!==ORIGIN||method!=='GET'||u.username||u.password||u.search||u.hash||/%|\\/.test(url))return false;
    return type==='document'?['/','/industries/legal'].includes(u.pathname):ASSETS.has(u.pathname)&&['stylesheet','script','image','font'].includes(type);
  }catch{return false;}
}
function oidcHeaders(token,now=Date.now()){
  // Local preflight is not signature verification. Vercel verifies the signed token and its trust policy.
  let c;try{if(typeof token!=='string'||token.length>16000||token.split('.').length!==3)throw Error();c=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}catch{throw new Error('Preview identity missing or invalid');}
  if(c.project_id!=='prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX'||c.owner_id!=='team_6Rg3DdCrvOml6oEGwx6Ndf1I'||c.environment!=='development'||!Number.isSafeInteger(c.exp)||c.exp*1000<=now||!Number.isSafeInteger(c.nbf)||c.nbf*1000>now)throw new Error('Preview identity unavailable');
  return {'x-vercel-trusted-oidc-idp-token':token};
}
function previewTransport({token,signal,fetchImpl=fetch,clock=Date.now}={}){
  const deadline=clock()+600000;let count=0;
  oidcHeaders(token,clock());
  return async({url,method,type})=>{
    if(signal?.aborted||clock()>=deadline||!allowed(url,method,type)||++count>256)throw new Error('Preview request denied');
    const response=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(Math.min(10000,deadline-clock()))]),headers:oidcHeaders(token,clock())});
    if(!response.ok||response.redirected||response.url&&response.url!==url)throw new Error('Preview access unconfirmed');
    const contentType=response.headers.get('content-type')||'';
    if(type==='document'&&!/^text\/html\b/.test(contentType))throw new Error('Unexpected Preview document');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5000000)throw new Error('Preview resource too large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
    // Never forward cookies, redirect locations or provider headers to the browser.
    return {status:200,contentType,body:Buffer.concat(chunks)};
  };
}
module.exports={ORIGIN,allowed,oidcHeaders,previewTransport,offlineFonts};
