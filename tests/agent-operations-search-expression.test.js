'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto'),expr=require('../lib/agent-operations-search-expression'),phone=require('../lib/agent-operations-phone-search');
test('every authenticated existing predicate fits the static pure expression contract',()=>{for(const f of phone.snapshot().files)for(const s of f.sites)a.equal(expr.validate(s.before,s.id).executionAuthorized,false);});
for(const text of ['!q||hay.includes(q)','String(x.phone||"").replace(/\\D/g,"")','/^[+\\d\\s().-]+$/.test(q)','q ? x.phone : ""','Array.isArray(x.messages)?x.messages.map(message=>message.text):[]','typeof x.phone === "string"','[x.caller,x.phone].join(" ").toLowerCase().includes(q)'])test('pure syntax accepted without evaluating source: '+text,()=>a.equal(expr.validate(text,'calls').version,expr.VERSION));
for(const text of [
 'callDispositionLabel.constructor("return process")()',
 'callDispositionLabel["constructor"]("return process")()',
 'callDispositionLabel.constr\\u0075ctor("return process")()',
 'String.constructor("return process")()',
 'Array.isArray.constructor("return process")()',
 'x.phone.constructor("return process")()',
 'x.phone["constr"+"uctor"]("return process")()',
 'globalThis.process.stdout.write("forged")',
 '(function(){return process})()',
 '(()=>{process.exit(0)})()',
 'x.phone="changed"','q++','delete x.phone',
 'q, process.exit(0)',
 'x.phone.replace(/\\D/g,()=>process.exit(0))',
 'x.messages.map(m=>m.constructor("return process")())',
 'x.messages.map(m=>{return m.text})',
 '({}).__proto__','q["constructor"]',
 'false ? process.exit(0) : hay.includes(q)',
 '/(a+)+$/.test(q)','new RegExp(q).test(q)',
 'q); process.exit(0); (q','q// hide following source','q/* hidden comment */'
])test('reporter capability and side-effect syntax denied: '+text,()=>a.throws(()=>expr.validate(text,'calls'),/PHONE_SEARCH_EXPRESSION/));
test('parser is the unchanged integrity-verified official distribution with license preserved',()=>{const root=require('node:path').join(__dirname,'../lib/vendor/'),m=require('../lib/vendor/acorn-8.19.0.provenance.json');a.equal(m.version,'8.19.0');a.equal(m.installScriptsExecuted,false);for(const[name,expected]of Object.entries(m.files)){const bytes=fs.readFileSync(root+name);a.equal(bytes.length,expected.bytes);a.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);}a(fs.readFileSync(root+'acorn-8.19.0.LICENSE','utf8').includes('MIT'));});
test('new closed diagnostic retains precise rule and location without rejected code',()=>{const f=require('../lib/agent-operations-engineering-failure'),v=f.sanitize({stage:'specialist',phase:'response-validate',category:'validation',code:'PHONE_SEARCH_EXPRESSION',location:'$.proposal.patch.files[0].edits[0].after',mismatch:'unsafe-expression'});a.equal(v.code,'PHONE_SEARCH_EXPRESSION');a.equal(v.ruleId,expr.VERSION);a.equal(v.location,'$.proposal.patch.files[0].edits[0].after');a.equal(f.sanitize({stage:'specialist',phase:'workspace-prepare',code:'DRAFT_BUNDLE_SYNTAX'}).code,'DRAFT_BUNDLE_SYNTAX');});
