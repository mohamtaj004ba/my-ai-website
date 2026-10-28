'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
function controls(text){
 const attrs=t=>Object.fromEntries([...t.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1],m[2]??m[3]]));
 const ids=new Set([...text.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
 const labels=new Set([...text.matchAll(/<label\b[^>]*>/g)].map(m=>attrs(m[0]).for).filter(Boolean));
 let labelDepth=0;const result=[];
 for(const match of text.matchAll(/<\/?(?:label|input|select|textarea)\b[^>]*>/g)){
  const tag=match[0];if(/^<label\b/.test(tag)){labelDepth++;continue;}if(/^<\/label/.test(tag)){labelDepth--;continue;}if(/^<\//.test(tag))continue;
  const attributes=attrs(tag);if(['hidden','submit','button','checkbox','radio'].includes(attributes.type))continue;
  result.push({id:attributes.id,attributes,named:!!labelDepth||labels.has(attributes.id)||!!attributes['aria-label']?.trim()||!!attributes['aria-labelledby']?.trim()&&attributes['aria-labelledby'].trim().split(/\s+/).every(id=>ids.has(id))});
 }
 return result;
}
for(const file of ['dashboard.html','admin-dashboard.html'])test(file+' static form controls retain an explicit name independent of placeholder/value',()=>{
 const html=fs.readFileSync(file,'utf8'),rows=controls(html);a(rows.length>10);a.deepEqual(rows.filter(x=>!x.named).map(x=>x.id),[]);
 for(const row of rows){a(row.id,'Reviewed static controls need stable identities');if(row.attributes['aria-label'])a(!/[<>]/.test(row.attributes['aria-label']));}
});
test('regression detects placeholder-only search and adjacent unlabeled filters',()=>{
 a.equal(controls('<input id="missing" aria-labelledby="absent">')[0].named,false);
 a.equal(controls('<input id="search" type="search" placeholder="Find contacts">')[0].named,false);
 a.equal(controls('<span>Range</span><select id="range"></select>')[0].named,false);
 a.equal(controls('<label for="query">Search</label><input id="query">')[0].named,true);
 a.equal(controls('<label>Range<select id="range"></select></label>')[0].named,true);
 a.equal(controls('<input id="query" value="entered" aria-label="Search contacts">')[0].named,true);
});
