const test=require('node:test'),assert=require('node:assert/strict');
const {parseTranscript,audit}=require('../scripts/voice-simulation-audit');
const m=(actor,text,args,seconds=1)=>({actor,text,args,seconds});
const confirmed=[m('Assistant','A repair at 42 Example Lane—is that correct?'),m('AI Tester','Yes, correct.'),m('save_call_request','', {confirmed:true,name:'Alex Reed',address:'42 Example Lane, Spokane'})];
test('simulation audit rejects a provider judge pass without required saves or observable ending',()=>{
  const result=audit([m('AI Tester','Goodbye.')],{saveCount:1,disposition:'request_captured'});
  assert.equal(result.evidenceGatePassed,false);assert.ok(result.failures.includes('SAVE_COUNT_MISMATCH'));assert.ok(result.unknown.includes('SUCCESSFUL_NATIVE_END_NOT_OBSERVED'));
});
test('simulation audit catches corrected detail save without an actual recap and invented alternate callback',()=>{
  const result=audit([m('Assistant','What is the best phone number?'),m('AI Tester','The address is 81 Example Court. The rest of your recap is correct.'),m('save_call_request','',{confirmed:true,callbackNumber:'+15095550190'})],{saveCount:1,originatingNumber:true});
  assert.ok(result.failures.includes('NO_OBSERVED_RECAP_AGREEMENT'));assert.ok(result.failures.includes('UNEXPECTED_ALTERNATE_CALLBACK'));
});
test('simulation audit checks corrected saved fields independently of the provider judge',()=>{
  const result=audit(confirmed,{saveCount:1,saveFields:{name:'Alex Reed',address:'81 Example Court, Spokane'}});
  assert.ok(result.failures.includes('SAVE_FIELD_MISMATCH:address'));assert.ok(!result.failures.includes('NO_OBSERVED_RECAP_AGREEMENT'));
});
test('simulation audit catches premature and repeated native endings',()=>{
  const result=audit([m('AI Tester','Wait, goodbye, but are you open tomorrow?'),m('endCall','RESPONSE\nSuccess.'),m('endCall','RESPONSE\nSuccess.')]);
  assert.ok(result.failures.includes('PREMATURE_NATIVE_END'));assert.ok(result.failures.includes('REPEATED_NATIVE_END'));
});
test('simulation audit flags false open-now answers without a lookup',()=>{
  const result=audit([m('AI Tester','Are you open now?'),m('Assistant','Yes. We are open right now.')],{closedNow:true});
  assert.ok(result.failures.includes('FALSE_OPEN_NOW'));assert.ok(result.failures.includes('HOURS_ANSWER_WITHOUT_LOOKUP'));
});
test('simulation audit permits observed supported completion while retaining acoustic and semantic limits',()=>{
  const result=audit([...confirmed,m('AI Tester','Goodbye.'),m('complete_call','',{disposition:'request_captured'}),m('endCall','RESPONSE\nSuccess.')],{saveCount:1,originatingNumber:true,disposition:'request_captured',saveFields:{address:'forty two Example Lane, Spokane'}});
  assert.equal(result.evidenceGatePassed,true);assert.equal(result.acousticAcceptance,false);assert.equal(result.canonicalMutationProof,false);assert.equal(result.requiresSemanticReview,true);
});
test('simulation parser extracts expanded tool arguments and rejects unavailable or malformed evidence',()=>{
  const messages=parseTranscript('Criteria\nTranscript\nAI Tester\n0:47\n\nYes, correct.\n\nsave_call_request\nResponse available\n0:49\n\nARGUMENTS\n\n{"confirmed":true}\n\nRESPONSE\n\n{"status":"captured"}');
  assert.equal(messages[1].seconds,49);assert.deepEqual(messages[1].args,{confirmed:true});
  assert.throws(()=>parseTranscript('Missing'));assert.throws(()=>parseTranscript('\nTranscript\nsave_call_request\nResponse available\n0:01\nARGUMENTS\nnot JSON\nRESPONSE\n{}'));
});
test('simulation audit does not infer subsecond consent order from tied displayed timestamps',()=>{
  const result=audit([m('Assistant','Is that correct?',null,70),m('save_call_request','',{confirmed:true},82),m('AI Tester','Yes, correct.',null,82)]);
  assert.ok(result.unknown.includes('RECAP_SAVE_ORDER_SAME_SECOND'));
  assert.ok(!result.failures.includes('NO_OBSERVED_RECAP_AGREEMENT'));
  assert.equal(result.evidenceGatePassed,false);
});
test('simulation audit rejects agreement visibly later than the save',()=>{
  const result=audit([m('Assistant','Is that correct?',null,70),m('save_call_request','',{confirmed:true},82),m('AI Tester','Yes, correct.',null,83)]);
  assert.ok(result.failures.includes('NO_OBSERVED_RECAP_AGREEMENT'));
});
test('simulation audit distinguishes rejected end attempts from a successful disconnect',()=>{
  const result=audit([m('AI Tester','Thank you.'),m('endCall','Tool call rejected based on configured rejection plan'),m('AI Tester','Goodbye.'),m('endCall','RESPONSE\nSuccess.')]);
  assert.equal(result.evidenceGatePassed,true);
  assert.ok(result.quality.includes('REJECTED_NATIVE_END_ATTEMPT'));
  assert.ok(!result.failures.includes('PREMATURE_NATIVE_END'));
  assert.ok(!result.failures.includes('REPEATED_NATIVE_END'));
});
test('simulation audit accepts explicitly allowed backend dispositions and rejects others',()=>{
  const input=[m('AI Tester','Goodbye.'),m('complete_call','',{disposition:'request_captured'}),m('endCall','RESPONSE\nSuccess.')];
  assert.equal(audit(input,{disposition:['message_taken','request_captured']}).evidenceGatePassed,true);
  assert.ok(audit(input,{disposition:['incomplete']}).failures.includes('DISPOSITION_MISMATCH'));
});
