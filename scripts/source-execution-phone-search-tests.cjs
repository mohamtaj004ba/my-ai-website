'use strict';
// Serializes tests for the existing OS-isolated guest. Never executes source here.
const {createHash}=require('node:crypto'),{isDeepStrictEqual:equal}=require('node:util'),phone=require('../lib/agent-operations-phone-search');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const TESTS=Object.freeze(['baseline-five-path-format-miss','equivalent-phone-formats-all-paths','partial-and-country-code-policy','free-text-mixed-and-punctuation-preserved','unrelated-and-missing-phone-controls','backend-filter-sort-paging-cursor-preserved','only-declared-source-sites-change']);
function buildProgram({baseline,patched}){
 const original=phone.snapshot();if(!equal(baseline,original.files)||!patched||Object.keys(patched).sort().join(',')!=='binding,proposal')throw Error('PHONE_TEST_SOURCE');
 phone.validateSearchExpressions(patched.proposal,{binding:patched.binding,files:baseline});
 const applied=phone.apply(patched.proposal,{binding:patched.binding,files:baseline}),sites=baseline.flatMap(f=>f.sites.map(s=>{const e=patched.proposal.files.find(v=>v.path===f.path).edits.find(e=>e.before===s.before);return{id:s.id,before:s.before,after:e.after};}));
 const sourceHashes={baseline:hash(baseline.map(f=>({path:f.path,sha256:f.sha256}))),patched:hash(applied.files.map(f=>({path:f.path,sha256:f.afterSha256}))),files:applied.files.map(f=>({path:f.path,before:f.beforeSha256,after:f.afterSha256}))};
 const payload={sites,backendBefore:baseline.find(f=>f.path==='lib/conversation-history.js').text,backendAfter:applied.files.find(f=>f.path==='lib/conversation-history.js').text,scopeIntegrity:applied.files.every((f,i)=>{let expected='',at=0;for(const e of patched.proposal.files[i].edits){expected+=baseline[i].text.slice(at,e.offset)+e.after;at=e.offset+e.before.length;}return expected+baseline[i].text.slice(at)===f.text;})};
 const program='('+guestProgram.toString()+')('+JSON.stringify(payload)+');';return{program,programSha256:hash(program),sourceHashes,testIds:[...TESTS],executionAuthorized:false};
}
function guestProgram(s){
 const vm=require('node:vm'),a=require('node:assert/strict'),crypto=require('node:crypto'),tests=[];
 function check(id,fn){try{fn();tests.push({id,passed:true});}catch{tests.push({id,passed:false});}}
 const record={id:'fictional-one',name:'Lucy',caller:'Lucy',phone:'+1 (509) 555-4578',reason:'Roof repair',last:'Roof repair',status:'active',address:'Fictional Road',category:'General question',agent:'Fictional Agent',services:['Roof repair'],messages:[{text:'Fictional roof discussion',at:100}],updatedAt:100};
 const cases=[{record,queries:['5095554578','+15095554578','(509) 555-4578','509.555.4578',' 509 555 4578 ']},{record:{...record,id:'fictional-noah',name:'Noah',caller:'Noah',phone:'1-212-555-0199'},queries:['2125550199','+12125550199','(212) 555-0199']},{record:{...record,id:'fictional-amina',name:'Amina',caller:'Amina',phone:'+44 (20) 7946-0958'},queries:['442079460958','2079460958','+44 20 7946 0958','20.7946.0958']}];
 function backend(code){const module={exports:{}},context=vm.createContext({module,exports:module.exports,Buffer,require:name=>{if(name==='crypto')return crypto;throw Error('module denied');}});vm.runInContext(code,context,{timeout:250});return module.exports.paginateConversations;}
 const beforeBackend=backend(s.backendBefore),afterBackend=backend(s.backendAfter);
 function match(id,query,r,after){
  if(id==='paged-conversations')return (after?afterBackend:beforeBackend)([r],{q:query}).total===1;
  const q=String(query||'').trim().toLowerCase(),context=vm.createContext({q,x:structuredClone(r),c:structuredClone(r),kind:'Client',hay:[r.caller,r.phone,r.category,r.reason,'Handled','Open',r.agent,r.address].join(' ').toLowerCase(),callDispositionLabel:()=> 'Handled',teamStatusLabel:()=> 'Open'}),site=s.sites.find(x=>x.id===id);
  return Boolean(vm.runInContext('('+site[after?'after':'before']+')',context,{timeout:100}));
 }
 function all(query,r=record,after=true){return s.sites.map(site=>match(site.id,query,r,after));}
 check('baseline-five-path-format-miss',()=>{a(all('5095554578',record,false).every(x=>!x));a(all('lucy',record,false).every(Boolean));});
 check('equivalent-phone-formats-all-paths',()=>{for(const entry of cases)for(const q of entry.queries)a(all(q,entry.record).every(Boolean));});
 check('partial-and-country-code-policy',()=>{for(const q of ['5554578','555-4578','509555'])a(all(q).every(Boolean));for(const q of ['+445095554578','5095550000'])a(all(q).every(x=>!x));});
 check('free-text-mixed-and-punctuation-preserved',()=>{for(const entry of cases)for(const q of ['',entry.record.name.toLowerCase(),'roof','active',entry.record.name+' 509','ext 4578','(',')','not present'])a.deepEqual(all(q,entry.record),all(q,entry.record,false));});
 check('unrelated-and-missing-phone-controls',()=>{for(const phone of ['',null,undefined,'+1 (212) 555-0199']){const r={...record,phone};for(const q of ['5095554578','509-555-4578'])a(all(q,r).every(x=>!x));}const r={...record,phone:'',last:'Invoice 509 555 4578',reason:'Invoice 509 555 4578'};a(all('5095554578',r).every(x=>!x));});
 check('backend-filter-sort-paging-cursor-preserved',()=>{
  const rows=[{...record,id:'first',updatedAt:300},{...record,id:'second',updatedAt:200,phone:'+15095554578'},{...record,id:'closed',status:'closed',updatedAt:100}];
  const page=afterBackend(rows,{q:'5095554578',filter:'active',limit:1});a.equal(page.total,2);a.equal(page.conversations[0].id,'first');a(page.nextCursor);
  const next=afterBackend(rows,{q:'5095554578',filter:'active',limit:1,cursor:page.nextCursor});a.equal(next.conversations[0].id,'second');a.equal(next.nextCursor,null);
  a.equal(afterBackend(rows,{q:'5095554578',sort:'oldest',limit:1}).conversations[0].id,'closed');a.throws(()=>afterBackend(rows,{q:'lucy',filter:'active',cursor:page.nextCursor}),e=>e.code==='INVALID_CURSOR');
 });
 check('only-declared-source-sites-change',()=>a.equal(s.scopeIntegrity,true));
 const passed=tests.every(t=>t.passed);process.stdout.write(JSON.stringify({version:'starter-source-behavioral-result-v1',fixtureDataOnly:true,tests,passed,qualified:false,publicationAuthorized:false})+'\n');process.exitCode=passed?0:1;
}
if(require.main===module)throw Error('PHONE_TEST_REQUIRES_QUALIFIED_DISPATCHER');
module.exports={TESTS,buildProgram};
