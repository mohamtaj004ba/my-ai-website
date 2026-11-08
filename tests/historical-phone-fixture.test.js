'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),phone=require('../lib/agent-operations-phone-search'),tools=require('../lib/agent-operations-engineering-tools'),{withHistoricalPhoneSource}=require('./helpers/historical-phone-fixture.cjs');
test('archived fixture restores admission and leaves source readers unchanged on success and failure',async()=>{
 const availability=phone.availability,evidence=phone.sourceEvidence,reader=tools.readPhoneSearchSource,before=phone.availability();
 for(const failure of [false,true]){
  const run=withHistoricalPhoneSource(async meta=>{a.match(meta.qualification,/archived/);a.equal(phone.availability().executionAuthorized,false);a.equal(phone.sourceEvidence().length,5);a.equal(tools.readPhoneSearchSource,reader);await a.rejects(withHistoricalPhoneSource(async()=>{}),/HISTORICAL_PHONE_TEST_SCOPE/);if(failure)throw Error('injected test interruption');});
  if(failure)await a.rejects(run,/injected test interruption/);else await run;
  a.equal(phone.availability,availability);a.equal(phone.sourceEvidence,evidence);a.equal(tools.readPhoneSearchSource,reader);a.deepEqual(phone.availability(),before);
 }
});
