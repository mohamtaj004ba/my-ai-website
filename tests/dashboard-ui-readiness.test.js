const test=require('node:test');
const assert=require('node:assert/strict');

test('dashboard readiness waits for actual state without changing the page',async t=>{
  const {dashboardUiReady,waitForDashboardUi}=await import('../scripts/dashboard-ui-readiness.mjs');
  const original={document:global.document,getComputedStyle:global.getComputedStyle,requestAnimationFrame:global.requestAnimationFrame};
  const node=(id='')=>({id,classes:new Set(['active']),attrs:{'aria-current':'page'},rect:{x:0,y:0,left:0,width:400,height:300},animations:[],classList:{contains(c){return this.owner.classes.has(c)}},getAttribute(k){return this.attrs[k]},getBoundingClientRect(){return this.rect},getAnimations(){return this.animations}});
  let active,main,sidebar,menu,backdrop,nav,panels,body,frames,frameAction;
  const reset=()=>{
    active=node('view-overview');main=node();sidebar=node();menu=node();backdrop={hidden:true};nav=node();panels=[active];body=node();body.classes.clear();body.dataset={dashboard:'client'};frames=0;frameAction=()=>{};
    for(const el of [active,main,sidebar,menu,nav,body])el.classList.owner=el;
    menu.attrs['aria-expanded']='false';sidebar.classes.clear();
    global.document={body,fonts:{status:'loaded'},querySelector(s){return s==='.dashboard-main'?main:s==='.sidebar'?sidebar:s==='.mobile-menu'?menu:s==='#navigationBackdrop'?backdrop:s.startsWith('button.nav-item')?nav:null},querySelectorAll(s){return s==='.view.active'?panels:[...panels,sidebar,main]}};
    global.getComputedStyle=()=>({visibility:'visible',display:'block'});
    global.requestAnimationFrame=cb=>{frameAction(++frames);cb()};
  };
  try{
    await t.test('ready view completes after three stable frames',async()=>{reset();assert.equal(await dashboardUiReady({view:'overview'}),true);assert.equal(frames,3)});
    await t.test('serialized browser function has no imported closure dependency',async()=>{reset();const browserFunction=(0,eval)('('+dashboardUiReady.toString()+')');assert.equal(await browserFunction({view:'overview'}),true)});
    await t.test('closed mobile sidebar must hide backdrop and collapse menu',async()=>{reset();assert.equal(await dashboardUiReady({sidebar:'closed'}),true);backdrop.hidden=false;assert.equal(await dashboardUiReady({sidebar:'closed'}),false);reset();menu.attrs['aria-expanded']='true';assert.equal(await dashboardUiReady({sidebar:'closed'}),false)});
    await t.test('missing backdrop fails closed',async()=>{reset();const query=document.querySelector.bind(document);document.querySelector=s=>s==='#navigationBackdrop'?null:query(s);assert.equal(await dashboardUiReady({sidebar:'closed'}),false)});
    await t.test('wrong or multiple active views fail',async()=>{reset();assert.equal(await dashboardUiReady({view:'calls'}),false);panels.push(node());assert.equal(await dashboardUiReady(),false)});
    await t.test('busy, loading and fonts remain blocking',async()=>{reset();main.attrs['aria-busy']='true';assert.equal(await dashboardUiReady(),false);reset();body.classes.add('client-data-loading');assert.equal(await dashboardUiReady(),false);reset();document.fonts.status='loading';assert.equal(await dashboardUiReady(),false)});
    await t.test('finite paused transitions block; perpetual decoration does not',async()=>{reset();active.animations=[{playState:'paused',effect:{getTiming:()=>({iterations:1})}}];assert.equal(await dashboardUiReady(),false);active.animations[0].effect.getTiming=()=>({iterations:Infinity});assert.equal(await dashboardUiReady(),true)});
    await t.test('mobile sidebar requires expanded state and final on-screen position',async()=>{reset();sidebar.classes.add('open');menu.attrs['aria-expanded']='true';backdrop.hidden=false;sidebar.rect.left=-150;assert.equal(await dashboardUiReady({sidebar:'open'}),false);sidebar.rect.left=0;assert.equal(await dashboardUiReady({sidebar:'open'}),true);assert.equal(await dashboardUiReady({sidebar:'closed'}),false)});
    await t.test('layout movement or renewed loading invalidates stable frames',async()=>{reset();frameAction=()=>main.rect.width++;assert.equal(await dashboardUiReady(),false);reset();frameAction=()=>main.attrs['aria-busy']='true';assert.equal(await dashboardUiReady(),false)});
    await t.test('Conversations validates Contacts navigation',async()=>{reset();active.id='view-conversations';const query=document.querySelector.bind(document);document.querySelector=s=>s.startsWith('button.nav-item')?(s.includes('contacts')?nav:null):query(s);assert.equal(await dashboardUiReady({view:'conversations'}),true);nav.attrs['aria-current']=null;assert.equal(await dashboardUiReady({view:'conversations'}),false)});
    await t.test('hard Playwright deadline is preserved and failures propagate',async()=>{let call;await waitForDashboardUi({waitForFunction:async(...args)=>call=args},{view:'overview'});assert.deepEqual(call[2],{polling:'raf',timeout:20000});await assert.rejects(waitForDashboardUi({waitForFunction:async()=>{throw Error('deadline')}}),/deadline/);await assert.rejects(waitForDashboardUi({}, {view:'bad"]'}),/Invalid/)});
  }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete global[key];else global[key]=value}}
});
