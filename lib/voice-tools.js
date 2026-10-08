const {hoursAt,E164}=require('./voice-policy');
const INTENTS=['service','estimate','existing_customer','appointment','status','complaint','reschedule','cancel','billing','human','general','wrong_number','spam','unclear'];
function definitions(){return [
  {name:'get_business_profile',description:'Retrieve approved business information, services, prices, policies and FAQs. No private customer account data.',parameters:{type:'object',properties:{},additionalProperties:false}},
  {name:'check_after_hours_policy',description:'Check current local business hours, holidays and allowed transfer behavior.',parameters:{type:'object',properties:{},additionalProperties:false}},
  {name:'save_call_request',description:'Save or amend the current caller request after confirming key details. Appointment is a request only, never a booking.',parameters:{type:'object',properties:{intent:{type:'string',enum:INTENTS},name:{type:'string',maxLength:120},callbackNumber:{type:'string',maxLength:16,description:'International E.164 number including country code, for example +15095550142. Confirm the country if uncertain; do not send a ten-digit local number.',pattern:'^\\+[1-9][0-9]{7,14}$'},reason:{type:'string',maxLength:1500},address:{type:'string',maxLength:300},preferredTime:{type:'string',maxLength:160},confirmed:{type:'boolean'}},required:['intent','reason','confirmed'],additionalProperties:false}},
  {name:'complete_call',description:'Record the actual call result and concise summary. Use resolved_by_ai only when the caller received the answer; request/message only after save_call_request succeeded.',parameters:{type:'object',properties:{disposition:{type:'string',enum:['resolved_by_ai','non_customer','message_taken','request_captured','incomplete']},summary:{type:'string',maxLength:1500}},required:['disposition','summary'],additionalProperties:false}},
  {name:'transfer_call',description:'Request a human through the configured destination and current business-hours rules. A requested transfer is not connected.',parameters:{type:'object',properties:{confirmed:{type:'boolean'}},required:['confirmed'],additionalProperties:false}}
]}
function argumentsFor(name,input){
  const definition=definitions().find(d=>d.name===name);if(!definition)throw new Error('Unsupported tool');
  let value=input;if(typeof input==='string'){if(input.length>5000)throw new Error('Tool input too large');value=JSON.parse(input)}
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(definition.parameters.properties,k)))throw new Error('Invalid tool arguments');
  // Classic model tool calls can encode an omitted optional field as null.
  // Normalize known optional fields only; required and unknown keys still fail.
  value=Object.fromEntries(Object.entries(value).filter(([key,val])=>val!==null||(definition.parameters.required||[]).includes(key)));
  for(const key of definition.parameters.required||[])if(!Object.hasOwn(value,key))throw new Error('Missing tool argument');
  for(const [key,val] of Object.entries(value)){const p=definition.parameters.properties[key];if(typeof val!==p.type||p.maxLength&&val.length>p.maxLength||p.enum&&!p.enum.includes(val))throw new Error('Invalid tool argument')}
  if(value.callbackNumber&&!E164.test(value.callbackNumber))throw Object.assign(new Error('Use an international callback number'),{code:'VOICE_CALLBACK_FORMAT_INVALID'});
  if(name==='save_call_request'&&!value.reason.trim())throw new Error('Request reason required');
  return value;
}
function profile(workspace,agent,policy,now){return {businessName:workspace.name,greeting:agent.openingMessage||'',services:policy.services,faqs:policy.faqs,serviceArea:policy.serviceArea,pricingGuidance:policy.pricingGuidance,hours:hoursAt(policy,now),emergencyGuidance:policy.emergencyGuidance,appointmentRule:'Capture a request for the team; no booking, cancellation or reschedule is confirmed.',privateAccountRule:'Do not disclose private customer/account details to an unverified caller.'}}
module.exports={definitions,argumentsFor,profile,INTENTS};

