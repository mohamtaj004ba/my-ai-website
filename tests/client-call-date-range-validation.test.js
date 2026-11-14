const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('dashboard.js','utf8');
const html=fs.readFileSync('dashboard.html','utf8');
const start=source.indexOf('function callDateBoundary(');
const end=source.indexOf('\nfunction callLogPrefsKey(',start);
assert.ok(start>=0&&end>start,'call date helpers must exist');

function fixture({filter='custom',from='2026-10-10',to='2026-10-09'}={}){
  const elements=new Map();
  function el(id){
    if(!elements.has(id))elements.set(id,{value:'',textContent:'',className:'',setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},focus(){this.focused=true}});
    return elements.get(id);
  }
  el('callDateFilter').value=filter;el('callDateFrom').value=from;el('callDateTo').value=to;
  const context=vm.createContext({document:{getElementById:el},Date,Number,String});
  vm.runInContext(source.slice(start,end),context);
  return {context,el};
}

test('custom call date range exposes shared accessible validation status',()=>{
  assert.match(html,/id="callDateFrom"[^>]*aria-describedby="callDateRangeStatus"/);
  assert.match(html,/id="callDateTo"[^>]*aria-describedby="callDateRangeStatus"/);
  assert.match(html,/id="callDateRangeStatus"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('reversed custom call date range is marked invalid and focuses the To date',()=>{
  const f=fixture();
  assert.equal(vm.runInContext('syncCallDateRangeValidation({focusInvalid:true})',f.context),false);
  assert.equal(f.el('callDateFrom')['aria-invalid'],'true');
  assert.equal(f.el('callDateTo')['aria-invalid'],'true');
  assert.equal(f.el('callDateTo').focused,true);
  assert.match(f.el('callDateRangeStatus').textContent,/on or after/i);
  assert.match(f.el('callDateRangeStatus').className,/error/);
});

test('valid or inactive custom date range clears stale invalid state',()=>{
  const f=fixture();
  vm.runInContext('syncCallDateRangeValidation()',f.context);
  f.el('callDateTo').value='2026-10-10';
  assert.equal(vm.runInContext('syncCallDateRangeValidation()',f.context),true);
  assert.equal(f.el('callDateFrom')['aria-invalid'],undefined);
  assert.equal(f.el('callDateTo')['aria-invalid'],undefined);
  assert.equal(f.el('callDateRangeStatus').textContent,'');
  f.el('callDateFilter').value='7';
  f.el('callDateTo').value='2026-10-01';
  assert.equal(vm.runInContext('syncCallDateRangeValidation()',f.context),true);
  assert.equal(f.el('callDateTo')['aria-invalid'],undefined);
});
