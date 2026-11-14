'use strict';
// Only imported by offline historical tests, never by application code or workers.
// The product has been corrected. These tests replay its explicitly frozen
// pre-correction task; this is NOT current-source or live compatibility evidence.
const impl=require('../../lib/agent-operations-implementation');
impl.sourceEvidence=impl.historicalEvidence;
impl.availability=()=>({status:'available-historical-offline-fixture',freshAssignmentAllowed:true,executionAuthorized:false});
