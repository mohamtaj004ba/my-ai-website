const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
function fixture(width=390){
  const listeners={},hit={dataset:{financeIndex:'0'},addEventListener:(event,fn)=>listeners[event]=fn};
  const tip={hidden:true,innerHTML:'',style:{}},shell={clientWidth:width,innerHTML:'',querySelectorAll:()=>[hit]};
  const ctx=vm.createContext({document:{getElementById:id=>id==='chart'?shell:tip},adminFinanceRange:12,adminFinanceData:{history:[{month:'2026-09',revenue:2000,expenses:300,source:'preview_reconstruction'}]},esc:String,financeMonthLabel:x=>x,financeMoney:x=>'$'+x});
  vm.runInContext(source.slice(source.indexOf('function renderFinanceChart('),source.indexOf('function renderAdminFinance(')),ctx);
  vm.runInContext("renderFinanceChart('chart','tip')",ctx);return {shell,tip,listeners};
}
test('finance chart uses the rendered width and exposes exact, explicitly estimated amounts to keyboard users',()=>{
  const {shell,tip,listeners}=fixture();
  assert.match(shell.innerHTML,/viewBox="0 0 390 300"/);
  assert.match(shell.innerHTML,/role="button" tabindex="0" aria-label="2026-09 estimated: MRR \$2000, expenses \$300"/);
  listeners.focus();assert.equal(tip.hidden,false);assert.match(tip.innerHTML,/estimated/);assert.match(tip.innerHTML,/Net run-rate/);
  listeners.blur();assert.equal(tip.hidden,true);
  let prevented=0,stopped=0;listeners.keydown({key:'Enter',preventDefault:()=>prevented++,stopPropagation:()=>stopped++});
  assert.equal(tip.hidden,false);assert.equal(prevented,1);assert.equal(stopped,1);
  listeners.keydown({key:'Escape',stopPropagation:()=>stopped++});assert.equal(tip.hidden,true);
  listeners.click({stopPropagation:()=>stopped++});assert.equal(tip.hidden,false);
});

test('finance tooltip recovers after empty loading state and remains usable across rerenders',()=>{
  const listeners={},tip={hidden:true,innerHTML:'',style:{}},hit={dataset:{financeIndex:'0'},addEventListener:(event,fn)=>listeners[event]=fn};
  const shell={clientWidth:390,innerHTML:'',querySelectorAll:()=>[hit]};
  const context=vm.createContext({document:{getElementById:id=>id==='chart'?shell:shell.innerHTML.includes('id="tip"')?tip:null},adminFinanceRange:6,adminFinanceData:{history:[]},esc:String,financeMonthLabel:x=>x,financeMoney:x=>'$'+x});
  vm.runInContext(source.slice(source.indexOf('function renderFinanceChart('),source.indexOf('function renderAdminFinance(')),context);
  vm.runInContext("renderFinanceChart('chart','tip')",context);
  assert.match(shell.innerHTML,/No finance history yet/);
  context.adminFinanceData.history=[{month:'2026-09',revenue:2000,expenses:300}];
  for(let render=0;render<2;render++){
    vm.runInContext("renderFinanceChart('chart','tip')",context);
    assert.match(shell.innerHTML,/id="tip" hidden/);
    listeners.focus();assert.equal(tip.hidden,false);assert.match(tip.innerHTML,/\$1700/);
    listeners.blur();assert.equal(tip.hidden,true);
  }
});

test('hidden finance charts rebuild for the measured width when their view becomes visible',()=>{
  let resized,observers=0;
  const shell={clientWidth:0,innerHTML:'',querySelectorAll:()=>[]};
  const context=vm.createContext({ResizeObserver:class{constructor(callback){resized=callback;observers++}observe(){}},document:{getElementById:()=>shell},adminFinanceRange:6,adminFinanceData:{history:[{month:'2026-09',revenue:2000,expenses:300}]},esc:String,financeMonthLabel:x=>x,financeMoney:x=>'$'+x});
  vm.runInContext(source.slice(source.indexOf('function renderFinanceChart('),source.indexOf('function renderAdminFinance(')),context);
  vm.runInContext("renderFinanceChart('chart','tip')",context);
  assert.match(shell.innerHTML,/viewBox="0 0 920 300"/);
  shell.clientWidth=390;resized();assert.match(shell.innerHTML,/viewBox="0 0 390 300"/);
  shell.clientWidth=792;resized();assert.match(shell.innerHTML,/viewBox="0 0 792 300"/);
  assert.equal(observers,1,'rerendering must not accumulate observers');
});

test('first and last finance month details fit inside compact chart edges',()=>{
  for(const width of [240,314,792]){
    const tip={hidden:true,innerHTML:'',offsetWidth:210,style:{}},handlers=[];
    const hits=[0,5].map((i,n)=>({dataset:{financeIndex:String(i)},addEventListener:(event,fn)=>{if(event==='focus')handlers[n]=fn}}));
    const shell={clientWidth:width,innerHTML:'',querySelectorAll:()=>hits};
    const context=vm.createContext({document:{getElementById:id=>id==='chart'?shell:tip},adminFinanceRange:6,adminFinanceData:{history:Array.from({length:6},(_,i)=>({month:'2026-'+i,revenue:8688,expenses:0}))},esc:String,financeMonthLabel:x=>x,financeMoney:x=>'$'+x});
    vm.runInContext(source.slice(source.indexOf('function renderFinanceChart('),source.indexOf('function renderAdminFinance(')),context);
    vm.runInContext("renderFinanceChart('chart','tip')",context);
    for(const show of handlers){show();const center=parseFloat(tip.style.left);assert.ok(center-105>=8);assert.ok(center+105<=width-8);assert.match(tip.innerHTML,/\$8688/)}
  }
});


test('refresh preserves the selected month and keyboard focus without reviving dismissed details',()=>{
  let hits=[],tip,markup='';
  const document={activeElement:null,getElementById:id=>id==='chart'?shell:tip};
  const shell={clientWidth:390,contains:el=>hits.includes(el),querySelectorAll:()=>hits};
  const context=vm.createContext({document,adminFinanceRange:6,adminFinanceData:{history:[{month:'2026-08',revenue:1000,expenses:100},{month:'2026-09',revenue:2000,expenses:300}]},esc:String,financeMonthLabel:x=>x,financeMoney:x=>'$'+x});
  Object.defineProperty(shell,'innerHTML',{get:()=>markup,set:value=>{
    markup=value;tip={hidden:true,innerHTML:'',style:{}};
    hits=context.adminFinanceData.history.map((row,i)=>{const handlers={};return {dataset:{financeIndex:String(i),financeMonth:row.month},handlers,addEventListener:(event,fn)=>handlers[event]=fn,focus(){document.activeElement=this;handlers.focus()}}});
  }});
  vm.runInContext(source.slice(source.indexOf('function renderFinanceChart('),source.indexOf('function renderAdminFinance(')),context);
  const render=()=>vm.runInContext("renderFinanceChart('chart','tip')",context);
  render();hits[1].focus();const oldHit=document.activeElement;
  context.adminFinanceData.history=[{month:'2026-09',revenue:2400,expenses:300}];render();
  assert.notEqual(document.activeElement,oldHit);assert.equal(document.activeElement,hits[0]);
  assert.equal(tip.hidden,false);assert.match(tip.innerHTML,/2400/);
  hits[0].handlers.keydown({key:'Escape',stopPropagation(){}});render();assert.equal(tip.hidden,true);
  hits[0].focus();const elsewhere={};document.activeElement=elsewhere;render();assert.equal(document.activeElement,elsewhere,'pointer details must not steal focus');
  context.adminFinanceData.history=[{month:'2026-10',revenue:3000,expenses:300}];render();assert.equal(tip.hidden,true);assert.equal(shell.financeChartActiveMonth,null);
});
