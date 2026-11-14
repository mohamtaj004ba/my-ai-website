'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the helper's actual browser predicate without launching a browser or faking product search.
const source=fs.readFileSync(require('node:path').join(__dirname,'../scripts/phone-search-browser-qa.mjs'),'utf8'),expression=source.match(/page\.waitForFunction\((\(\{previous,changed\}\)=>[^\n]+),\{previous,changed\}\)/)[1];
function ready({request=4,loading=false,error='',signature='["5095554578","all","newest"]',backend=true,changed=true}={}){return vm.runInNewContext('('+expression+')({previous:4,changed})',{changed,conversationPageRequest:request,conversationPageLoading:loading,conversationPageError:error,conversationBackendPaging:backend,conversationLastFilterSignature:signature,conversationFilter:'all',document:{querySelector:selector=>({value:selector==='#conversationSearch'?'5095554578':'newest'})}});}
test('unchanged query/filter can settle without a nonexistent new request',()=>a.equal(ready({changed:false}),true));
test('changed query must pass debounce and request advancement',()=>{a.equal(ready(),false);a.equal(ready({request:5}),true);});
test('an older request cannot satisfy changed query even after advancement',()=>a.equal(ready({request:5,signature:'["old query","all","newest"]'}),false));
test('pending or failed requests never count as complete; local synchronous path needs no request',()=>{a.equal(ready({request:5,loading:true}),false);a.equal(ready({request:5,error:'Unavailable'}),false);a.equal(ready({backend:false}),true);});
