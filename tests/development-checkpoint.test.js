'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),checkpoint=require('../scripts/development-checkpoint.cjs');
test('recovery pointer refuses credential-like or unbounded next actions before collecting state',()=>{
 for(const next of ['', 'x'.repeat(401),'Review\nsource','Use Bearer credential','Copy sk-projectvalue','Record password'])assert.throws(()=>checkpoint.snapshot(next));
});
test('recovery pointer never grants authority or treats old hosted observations as fresh',()=>{
 const s=checkpoint.snapshot('Inspect the recorded verification checkpoint');
 assert.equal(s.executionPermission,false);assert.equal(s.authority.freshCheckRequired,true);assert.equal(s.authority.workerStatus,'requires-current-process-readback');
 assert.match(s.head,/^[a-f0-9]{40}$/);assert.match(s.applicationSource,/^[a-f0-9]{40}$/);assert(Array.isArray(s.dirty));
 if(s.verification)assert.equal(s.verification.scope,'local-only; remote/configuration acceptance must be refreshed');
});
