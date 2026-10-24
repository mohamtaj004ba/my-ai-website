'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const impl=require('../lib/agent-operations-implementation');
test('all capability directory surfaces distinguish fixed Starter testing from arbitrary execution authority',()=>{
 const surfaces=[impl.capabilities(),require('../lib/agent-operations-engineering-tools').capabilities().implementationPreparation,require('../lib/agent-operations-departments').directory().implementationPreparation];
 for(const value of surfaces){
  a.equal(value.generatedCodeExecution,false);a.equal(value.publicationAuthorized,false);
  a.equal(value.fixedSourceTests.profile,require('../lib/agent-operations-source-test-dispatch').PROFILE);
  a.equal(value.fixedSourceTests.status,'implemented-separate-owner-permission-required');
  for(const flag of ['executionAuthorized','arbitraryCommands','network','publicationAuthorized'])a.equal(value.fixedSourceTests[flag],false);
  a.match(value.authorityLevels.find(x=>x.level===5).status,/arbitrary-code-disabled/);
  a.equal(value.authorityLevels.find(x=>x.level===9).status,'disabled');
  a.equal(value.authorityLevels.find(x=>x.level===10).status,'prohibited');
 }
});
test('mutating a capability readout cannot enable later directory reads',()=>{
 const view=impl.capabilities();view.fixedSourceTests.executionAuthorized=true;
 a.equal(impl.capabilities().fixedSourceTests.executionAuthorized,false);
});
