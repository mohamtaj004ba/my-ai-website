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
