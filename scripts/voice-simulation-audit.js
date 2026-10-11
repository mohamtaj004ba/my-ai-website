// Offline evidence gate for fictional simulation transcripts. Never calls a
// provider, writes business data, or substitutes for acoustic/phone acceptance.
const ACTORS=['AI Tester','Assistant','get_business_profile','check_after_hours_policy','save_call_request','transfer_call','complete_call','endCall'];
function parseTranscript(detail){
  const start=detail.indexOf('\nTranscript\n');
  if(start<0)throw new Error('Simulation transcript missing');
  const text=detail.slice(start),pattern=new RegExp('^('+ACTORS.join('|')+')\\n(?:Response available\\n)?(\\d+):(\\d+)\\n','gm');
  const matches=[...text.matchAll(pattern)];
  return matches.map((m,i)=>{
    const body=text.slice(m.index+m[0].length,matches[i+1]?.index??text.length).trim();
    let args=null;const a=body.indexOf('ARGUMENTS\n'),r=body.indexOf('\nRESPONSE\n');
    if(a>=0){try{args=JSON.parse(body.slice(a+'ARGUMENTS\n'.length,r<0?undefined:r).trim())}catch{throw new Error('Unparseable displayed tool arguments')}}
    return {actor:m[1],seconds:Number(m[2])*60+Number(m[3]),text:body,args};
  });
}
function audit(messages,expected={}){
  if(!Array.isArray(messages)||messages.some(m=>!ACTORS.includes(m.actor)||typeof m.text!=='string'||!Number.isFinite(m.seconds)))throw new Error('Invalid simulation messages');
  const failures=[],unknown=[],quality=[];
  const saves=messages.filter(m=>m.actor==='save_call_request'),ends=messages.filter(m=>m.actor==='endCall');
  const speech=messages.filter(m=>m.actor==='Assistant');
  if(expected.saveCount!==undefined&&saves.length!==expected.saveCount)failures.push('SAVE_COUNT_MISMATCH');
  for(const save of saves){
    if(!save.args){unknown.push('SAVE_ARGUMENTS_UNAVAILABLE');continue}
    if(save.args.confirmed!==true)failures.push('SAVE_WITHOUT_CONFIRMED_ARGUMENT');
    const before=messages.slice(0,messages.indexOf(save));
    const recap=before.findLastIndex(m=>m.actor==='Assistant'&&/\b(recap|confirm|correct)\b/i.test(m.text));
    if(recap<0||!before.slice(recap+1).some(m=>m.actor==='AI Tester'&&/\b(yes|correct|right|accurate)\b/i.test(m.text))){
      const tiedAgreement=recap>=0&&messages.slice(messages.indexOf(save)+1).some(m=>m.actor==='AI Tester'&&m.seconds===save.seconds&&/\b(yes|correct|right|accurate)\b/i.test(m.text));
      if(tiedAgreement)unknown.push('RECAP_SAVE_ORDER_SAME_SECOND');
      else failures.push('NO_OBSERVED_RECAP_AGREEMENT');
    }
    if(expected.originatingNumber&&save.args.callbackNumber!=null)failures.push('UNEXPECTED_ALTERNATE_CALLBACK');
    for(const [key,value] of Object.entries(expected.saveFields||{})){
      const normalize=s=>String(s??'').toLowerCase().replace(/forty two/g,'42').replace(/eighty one/g,'81').replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
      if(normalize(save.args[key])!==normalize(value))failures.push('SAVE_FIELD_MISMATCH:'+key);
    }
  }
  for(const end of ends){
    if(/Tool call rejected based on configured rejection plan/.test(end.text)){quality.push('REJECTED_NATIVE_END_ATTEMPT');continue}
    const caller=messages.slice(0,messages.indexOf(end)).findLast(m=>m.actor==='AI Tester');
    if(!caller||!/(?:\bbye\b|goodbye|end (?:the|this) call|hang up)/i.test(caller.text)||/\?|\b(wait|before|another question|do not|don't)\b/i.test(caller.text))failures.push('PREMATURE_NATIVE_END');
    if(!/Success\./.test(end.text))unknown.push('NATIVE_END_SUCCESS_UNAVAILABLE');
  }
  const successfulEnds=ends.filter(m=>/Success\./.test(m.text));
  if(successfulEnds.length>1)failures.push('REPEATED_NATIVE_END');
  if(!successfulEnds.length)unknown.push('SUCCESSFUL_NATIVE_END_NOT_OBSERVED');
  if(expected.disposition){
    const completed=messages.filter(m=>m.actor==='complete_call');
    if(!completed.length)unknown.push('COMPLETION_NOT_OBSERVED');
    else if(completed.some(m=>!m.args))unknown.push('COMPLETION_ARGUMENTS_UNAVAILABLE');
    else if(completed.some(m=>!(Array.isArray(expected.disposition)?expected.disposition:[expected.disposition]).includes(m.args.disposition)))failures.push('DISPOSITION_MISMATCH');
  }
  if(expected.closedNow){
    const firstAnswer=speech[0];
    if(firstAnswer&&/\b(?:yes|open right now|currently open)\b/i.test(firstAnswer.text))failures.push('FALSE_OPEN_NOW');
    if(firstAnswer&&!messages.slice(0,messages.indexOf(firstAnswer)).some(m=>m.actor==='check_after_hours_policy'))failures.push('HOURS_ANSWER_WITHOUT_LOOKUP');
  }
  if(speech.some(m=>/sent to (?:the )?(?:office|team)|reach out to you soon/i.test(m.text)))failures.push('UNVERIFIED_DELIVERY_OR_TIMING_CLAIM');
  if(speech.some(m=>m.text.split(/\s+/).length>40))quality.push('LONG_ASSISTANT_TURN');
  // These checks deliberately do not pretend to understand every natural-language
  // consent, promise or phone digit. Their absence never proves semantic quality.
  return {evidenceGatePassed:failures.length===0&&unknown.length===0,failures:[...new Set(failures)],unknown:[...new Set(unknown)],quality:[...new Set(quality)],counts:{saveAttempts:saves.length,nativeEndAttempts:ends.length,successfulNativeEnds:successfulEnds.length},requiresSemanticReview:true,acousticAcceptance:false,canonicalMutationProof:false};
}
module.exports={parseTranscript,audit};
if(require.main===module){
  const fs=require('fs'),file=process.argv[2];if(!file)throw new Error('Provide a local fictional simulation evidence JSON file');
  const cases=JSON.parse(fs.readFileSync(file,'utf8'));
  console.log(JSON.stringify(cases.map(c=>({caseId:c.caseId,iteration:c.iteration,url:c.url,...audit(parseTranscript(c.detail),c.expected)})),null,2));
}
