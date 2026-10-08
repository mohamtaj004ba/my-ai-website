import assert from 'node:assert/strict';
import path from 'node:path';
import {feedbackRequestHeaders} from './public-feedback-browser-qa.mjs';
export async function verifyIndustryNarratives({browser,baseURL,headers={},outDir,slugs=['home-services','professional-services','medical','automotive','property','legal']}){
 const report={checks:[],screenshots:[]};
 for(const width of [1440,1024,768,430,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.route('**/*',route=>route.continue({headers:feedbackRequestHeaders(route.request().url(),{...route.request().headers(),...headers},baseURL)}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const slug of slugs){
   await page.goto(baseURL+'/industries/'+slug);await page.locator('.industry-hero-visual img').evaluate(img=>img.decode());
   assert.equal(await page.locator('h1').count(),1);
   const audit=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return{overflow:document.documentElement.scrollWidth>innerWidth+2,duplicates:ids.filter((id,i)=>ids.indexOf(id)!==i),badAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash),tiny:[...document.querySelectorAll('.industry-narrative p:not(.kicker),.industry-narrative li,.industry-narrative dd,.industry-narrative button')].filter(el=>el.getBoundingClientRect().height&&parseFloat(getComputedStyle(el).fontSize)<14).length};});
   assert.equal(audit.overflow,false,slug+' overflow '+width);assert.deepEqual(audit.duplicates,[]);assert.deepEqual(audit.badAnchors,[]);assert.equal(audit.tiny,0,slug+' body text below 14px at '+width);
   const contrast=await page.evaluate(()=>{
    const rgb=value=>value.match(/[\d.]+/g)?.map(Number),luminance=rgb=>rgb.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4)}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    return [...document.querySelectorAll('.industry-narrative h2,.industry-narrative h3,.industry-narrative p,.industry-narrative blockquote,.industry-narrative dt,.industry-narrative dd,.industry-narrative button')].filter(el=>el.getBoundingClientRect().height).flatMap(el=>{
     const style=getComputedStyle(el);let parent=el,background;
     while(parent){const values=rgb(getComputedStyle(parent).backgroundColor);if(values&&(values.length===3||values[3]===1)){background=values;break}parent=parent.parentElement;}
     if(!background)return[];const fg=luminance(rgb(style.color)),bg=luminance(background),ratio=(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
     return ratio+0.01<(large?3:4.5)?[{text:el.textContent.slice(0,70),ratio}]:[];
    });
   });assert.deepEqual(contrast,[],slug+' contrast '+width);
   assert.equal(await page.locator('.industry-hero .button').getAttribute('href'),'/contact');
   if(width<=768){await page.locator('.menu').click();assert.equal(await page.locator('.menu').getAttribute('aria-expanded'),'true');await page.locator('#primary-nav a').first().waitFor({state:'visible'});await page.locator('.menu').click();}
   if(slug==='home-services'){
    const choices=page.locator('[data-scenario]');assert.equal(await choices.count(),4);
    for(let i=0;i<4;i++){await choices.nth(i).click();assert.equal(await choices.nth(i).getAttribute('aria-expanded'),'true');assert.equal(await page.locator('.scenario-panel:visible').count(),1);assert.equal(await page.locator('.scenario-panel:visible li').count(),4);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
    await choices.first().focus();await page.keyboard.press('Enter');assert.equal(await choices.first().getAttribute('aria-expanded'),'true');
   }
   const cta=page.locator('.industry-close .close-link'),href=await cta.getAttribute('href');assert.ok(['/live-demo','/contact','/get-started'].includes(href));await cta.click();assert.equal(new URL(page.url()).pathname,href);await page.goBack();
   if(outDir){await page.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)});const file='industry-'+slug+'-'+width+'.png';await page.screenshot({path:path.join(outDir,file),fullPage:true});report.screenshots.push(file);}
   report.checks.push({slug,width,passed:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});const page=await context.newPage();
 await context.route('**/*',route=>route.continue({headers:feedbackRequestHeaders(route.request().url(),{...route.request().headers(),...headers},baseURL)}));
 await page.goto(baseURL+'/industries/home-services');assert.equal(await page.locator('.scenario-panel:visible').count(),4);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);await context.close();
 report.noScriptScenarios=true;
 const reduced=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:900}}),reducedPage=await reduced.newPage();
 await reduced.route('**/*',route=>route.continue({headers:feedbackRequestHeaders(route.request().url(),{...route.request().headers(),...headers},baseURL)}));
 await reducedPage.goto(baseURL+'/industries/home-services');assert.equal(await reducedPage.locator('.scenario-panel:visible').count(),1);await reducedPage.locator('[data-scenario]').last().click();assert.equal(await reducedPage.locator('#scenario-boundary').isVisible(),true);await reduced.close();report.reducedMotion=true;return report;
}
