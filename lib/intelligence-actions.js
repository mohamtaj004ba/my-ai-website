// Models propose intent. Application code owns permissions, fields and execution.
const AGENT_FIELDS=new Set(['name','role','tone','openingMessage','serviceArea','businessHours','handlingInstructions']);
const TOOL={type:'function',name:'prepare_action',description:'Prepare a requested change for the user to review and apply. Never execute changes or claim success. Use only for an explicit request to change data or submit a request.',strict:true,parameters:{type:'object',properties:{kind:{type:'string',enum:['receptionist','followup','admin_request']},target:{type:'string',description:'Workspace ID for an admin receptionist change, call ID for follow-up, otherwise empty.'},field:{type:'string',description:'Receptionist field name, status for follow-up, or request subject for admin_request.'},value:{type:'string',description:'New text, completed/dismissed/pending for status, or request details.'}},required:['kind','target','field','value'],additionalProperties:false}};
function validateIntent(raw,{admin=false}={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['kind','target','field','value'].includes(k)))throw new Error('Unsupported action.');
  const {kind,target,field,value}=raw;
  if([kind,target,field,value].some(x=>typeof x!=='string')||target.length>120||value.length>4000)throw new Error('Invalid action details.');
  if(kind==='receptionist'){if(!AGENT_FIELDS.has(field)||!value.trim()||value.length>({name:80,role:120,tone:80,openingMessage:1200,serviceArea:500,businessHours:500,handlingInstructions:1800}[field]||0))throw new Error('This receptionist field cannot be changed through Intelligence.');if(admin&&!/^[A-Za-z0-9_-]{1,80}$/.test(target))throw new Error('Choose a specific client first.');}
  else if(kind==='followup'){if(admin||!target||field!=='status'||!['completed','dismissed','pending'].includes(value))throw new Error('Unsupported follow-up action.');}
  else if(kind==='admin_request'){if(admin||field.trim().length<3||field.length>160||value.trim().length<10)throw new Error('Provide a subject and request details.');}
  else throw new Error('Unsupported action.');
  return {kind,target,field:field.trim(),value:kind==='receptionist'?value.trim():value};
}
function responseText(data){
  if(!data||typeof data!=='object'||Array.isArray(data)||data.status!=='completed'||data.error||!Array.isArray(data.output))throw new Error('OpenAI response could not be verified');
  return data.output.flatMap(x=>Array.isArray(x?.content)?x.content:[]).filter(x=>x?.type==='output_text'&&typeof x.text==='string').map(x=>x.text).join('\n').trim();
}
module.exports={TOOL,validateIntent,responseText};
