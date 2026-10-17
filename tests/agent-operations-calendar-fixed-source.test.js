'use strict';
const test=require('node:test'),a=require('node:assert/strict'),tools=require('../lib/agent-operations-engineering-tools');
const historical=require('./helpers/historical-calendar-source.cjs'),v3=require('../lib/agent-operations-engineering-calendar-boundaries'),v2=require('../lib/agent-operations-engineering-calendar'),v1=require('../lib/agent-operations-draft-correction');
test('current fixed source rejects all retired defect profiles; historical bytes remain exactly pinned',()=>{
 const current=tools.readFile('dashboard.js');a.notEqual(tools.hash(current),historical.PIN);a.equal(current.includes(v3.HELPER),true);a.equal(tools.hash(historical.historicalText()),historical.PIN);a.throws(()=>v1.apply(current),/DRAFT_PREIMAGE/);a.throws(()=>v2.proposal(current),/SOURCE_DRIFT/);a.throws(()=>v3.proposal(current),/SOURCE_DRIFT/);for(const profile of [v1.PROFILE,v2.PROFILE,v3.PROFILE])a.throws(()=>tools.inspectCorrection(profile),/SOURCE_DRIFT/);
});
test('historical replay restores filesystem reads and current manifest after successful or interrupted tests',async()=>{
 const fs=require('node:fs'),original=fs.readFileSync,before=tools.readFile('dashboard.js'),lock=structuredClone(require('../lib/agent-operations-engineering-source-lock.json'));
 await historical.withHistorical(()=>{a.equal(tools.hash(tools.readFile('dashboard.js')),historical.PIN);a.equal(v3.proposal(tools.readFile('dashboard.js')).edits.length,3);});a.equal(fs.readFileSync,original);a.equal(tools.readFile('dashboard.js'),before);a.deepEqual(require('../lib/agent-operations-engineering-source-lock.json'),lock);
 await a.rejects(historical.withHistorical(async()=>{await Promise.resolve();throw Error('deliberate fixture interruption');}),/deliberate/);a.equal(fs.readFileSync,original);a.equal(tools.readFile('dashboard.js'),before);a.deepEqual(require('../lib/agent-operations-engineering-source-lock.json'),lock);
});
