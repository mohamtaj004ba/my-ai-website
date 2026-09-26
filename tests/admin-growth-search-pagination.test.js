const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dashboard.js','utf8');
const start=source.indexOf('const growthColumnVisibleLimits=Object.create(null);');
const end=source.indexOf('const prospectStagePending=new Set();',start);
assert.ok(start>=0&&end>start);
function fixture(){
  const prospects=Array.from({length:30},(_,i)=>({id:'lead-'+i,name:'Lead '+i,stage:'qualified',notes:i===29?'Hidden needle notes':'',updatedAt:100-i}));
  prospects.push({id:'paid-lead',name:'Paid',stage:'converted',tags:['VIP-retained'],updatedAt:200});
  const search={value:'',oninput:null},coverage={textContent:''},pipeline={
    innerHTML:'',more:[],querySelectorAll(selector){
      if(selector!=='[data-growth-more]')return [];
      const matches=[...this.innerHTML.matchAll(/data-growth-more="([^"]+)"/g)];
      this.more=matches.map(match=>({
        dataset:{growthMore:match[1]},addEventListener(name,fn){if(name==='click')this.click=fn}
      }));
      return this.more;
    }
  };
  const context=vm.createContext({
    adminWebsiteData:{prospects,coverage:{isRetentionCapped:false}},adminWebsiteLoadError:'',
    growthSearch:'',growthFilter:'open',adminCampaignData:[],adminPlatformData:{leadFollowupHours:24},
    document:{getElementById:id=>id==='growthSearch'?search:id==='growthPipeline'?pipeline:id==='growthCoverageNote'?coverage:null,
      querySelectorAll:()=>[]},
    prospectDue:()=>false,prospectValue:()=>0,financeMoney:n=>'$'+n,esc:s=>String(s),
    growthBucket:stage=>stage==='converted'?'converted':stage==='qualified'?'qualified':'new',
    Date,Number,Object,Array,Math,String
  });
  vm.runInContext(source.slice(start,end),context);
  const render=()=>vm.runInContext('renderGrowth()',context);
  return {context,prospects,pipeline,search,render};
}
const countCards=html=>(html.match(/class="growth-card /g)||[]).length;
test('Growth can reveal all retained records instead of permanently hiding records after 12',()=>{
  const f=fixture();f.context.growthFilter='qualified';f.render();
  assert.equal(countCards(f.pipeline.innerHTML),12);
  assert.match(f.pipeline.innerHTML,/Show 12 more · 12 of 30/);
  assert.equal(f.pipeline.more.length,1);f.pipeline.more[0].click();
  assert.equal(countCards(f.pipeline.innerHTML),24);
  assert.match(f.pipeline.innerHTML,/Show 6 more · 24 of 30/);
  f.pipeline.more[0].click();
  assert.equal(countCards(f.pipeline.innerHTML),30);
  assert.doesNotMatch(f.pipeline.innerHTML,/data-growth-more=/);
});
test('search spans paid and open stages and matches notes, owners, category and tags',()=>{
  const f=fixture();f.render();assert.doesNotMatch(f.pipeline.innerHTML,/paid-lead/);
  f.search.value='vip-retained';f.search.oninput();
  assert.equal(f.context.growthFilter,'all');
  assert.match(f.pipeline.innerHTML,/data-edit-prospect="paid-lead"/);
  f.search.value='hidden needle notes';f.search.oninput();
  assert.match(f.pipeline.innerHTML,/data-edit-prospect="lead-29"/);
  assert.equal(countCards(f.pipeline.innerHTML),1);
});
test('new search resets incremental page limits for a new result set',()=>{
  const f=fixture();f.context.growthFilter='qualified';f.render();f.pipeline.more[0].click();
  assert.equal(countCards(f.pipeline.innerHTML),24);
  f.search.value='Lead';f.search.oninput();
  assert.equal(countCards(f.pipeline.innerHTML),12);
  assert.match(f.pipeline.innerHTML,/Show 12 more/);
});
