'use strict';

const FIRST_NAMES=['Emma','Liam','Olivia','Noah','Ava','Ethan','Sophia','Mason','Mia','Lucas','Isabella','Logan','Amelia','James','Harper','Benjamin','Evelyn','Henry','Charlotte','Jack','Ella','Daniel','Grace','Alexander','Chloe','Michael','Nora','Samuel','Layla','David','Zoey','Joseph','Lily','Matthew','Hannah','Andrew','Natalie','Ryan','Claire','Nathan','Audrey','Caleb','Lucy','Luke','Maya','Isaac','Leah','Owen','Sophie'];
const LAST_NAMES=['Johnson','Martinez','Nguyen','Thompson','Anderson','Garcia','Wilson','Davis','Clark','Lewis','Walker','Hall','Young','Allen','King','Wright','Scott','Green','Baker','Adams','Nelson','Hill','Campbell','Mitchell','Roberts','Turner','Phillips','Parker','Evans','Edwards'];
const CALL_SCENARIOS=[
  {category:'New service',reason:'No heat / furnace issue',outcome:'Qualified',weight:11,value:420},
  {category:'New service',reason:'AC not cooling',outcome:'Qualified',weight:9,value:380},
  {category:'New service',reason:'Seasonal HVAC tune-up',outcome:'Qualified',weight:6,value:189},
  {category:'New service',reason:'Furnace replacement estimate',outcome:'Qualified',weight:5,value:7800},
  {category:'New service',reason:'Strange furnace noise',outcome:'Qualified',weight:5,value:640},
  {category:'Existing job',reason:'Checking technician arrival time',outcome:'Resolved',weight:8},
  {category:'Existing job',reason:'Reschedule service visit',outcome:'Follow-up',weight:5},
  {category:'Existing job',reason:'Question about completed work',outcome:'Follow-up',weight:4},
  {category:'Estimate follow-up',reason:'Following up on an estimate',outcome:'Follow-up',weight:6},
  {category:'Estimate follow-up',reason:'Question about estimate scope or price',outcome:'Follow-up',weight:4},
  {category:'Billing',reason:'Question about invoice or payment',outcome:'Follow-up',weight:4},
  {category:'Billing',reason:'Requesting a receipt or invoice copy',outcome:'Resolved',weight:2},
  {category:'Complaint',reason:'Unhappy with prior service',outcome:'Follow-up',weight:3},
  {category:'Complaint',reason:'Technician missed expected arrival window',outcome:'Follow-up',weight:2},
  {category:'General question',reason:'Asking about business hours',outcome:'Resolved',weight:4},
  {category:'General question',reason:'Asking what brands the company services',outcome:'Resolved',weight:3},
  {category:'General question',reason:'Asking whether the company serves their area',outcome:'Resolved',weight:3},
  {category:'Warranty',reason:'Warranty question about previous repair',outcome:'Follow-up',weight:3},
  {category:'Vendor',reason:'Supplier or vendor calling for the office',outcome:'Resolved',weight:2},
  {category:'Employment',reason:'Job applicant asking about open positions',outcome:'Resolved',weight:2},
  {category:'Wrong number',reason:'Caller reached the wrong business',outcome:'Resolved',weight:2},
  {category:'Spam',reason:'Unsolicited sales call',outcome:'Resolved',weight:2}
];
const WEIGHTED_SCENARIOS=CALL_SCENARIOS.flatMap(s=>Array.from({length:s.weight},()=>s));
const STAGES=['New','Contacted','Qualified','Appointment','Won','Lost'];
const CITY_DATA=[
  ['Spokane','WA','99201'],['Spokane Valley','WA','99216'],['Liberty Lake','WA','99019'],
  ['Cheney','WA','99004'],['Airway Heights','WA','99001'],['Mead','WA','99021']
];
const STREETS=['N Monroe St','E Sprague Ave','S Grand Blvd','W Francis Ave','E 29th Ave','N Division St','S Regal St','E Mission Ave','W Garland Ave','N Argonne Rd'];

function pick(list,i,offset=0){return list[(i+offset)%list.length]}
function nameFor(i){return pick(FIRST_NAMES,i)+' '+pick(LAST_NAMES,i*7+3)}
function phoneFor(i){const n=1000+((i*37+211)%8999);return '(509) 555-'+String(n).padStart(4,'0')}
function dayAt(daysAgo,hour,minute){const d=new Date();d.setSeconds(0,0);d.setDate(d.getDate()-daysAgo);d.setHours(hour,minute,0,0);return d.getTime()}
function timeLabel(ts){return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
function dateLabel(ts){return new Date(ts).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
function durationFor(i){const sec=95+((i*41)%330);return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}

function transcriptFor(person,category,reason,address,outcome,i){
  const first=person.split(' ')[0],open=['Maya','Thank you for calling Summit Heating & Air. This is Maya. How can I help you today?'];
  if(outcome==='Missed')return [['CallerCore','Missed call detected. Team follow-up created.']];
  if(category==='Wrong number')return [open,[first,'Hi, I was trying to reach a different company.'],['Maya','No problem. You reached Summit Heating & Air. It sounds like you may have the wrong number.'],[first,'Yes, I do. Sorry about that.'],['Maya','No worries. Have a good day.']];
  if(category==='Spam')return [open,[first,'I am calling to offer your company a marketing service.'],['Maya','Thank you, but I cannot connect unsolicited sales calls to the service team.'],[first,'Understood.'],['Maya','Have a good day.']];
  if(category==='Vendor')return [open,[first,'I am calling from a supplier and need to leave a message for the office.'],['Maya','I can take a message. What should I pass along?'],[first,'Please ask purchasing to call me back about an order.'],['Maya','Got it. I will pass that along to the office.']];
  if(category==='Employment')return [open,[first,'I am calling to ask whether you are hiring technicians right now.'],['Maya','I can note your question for the office. What is the best callback number?'],[first,'The number I am calling from is best.'],['Maya','Thank you. I will pass your message along.']];
  if(category==='General question')return [open,[first,'I have a quick question: '+reason.toLowerCase()+'.'],['Maya','Absolutely. I can help with general company information.'],[first,'That is all I needed.'],['Maya','Happy to help. Have a great day.']];
  if(category==='Existing job')return [open,[first,'I already have a job with you. I am calling because '+reason.toLowerCase()+'.'],['Maya','I can document that for the office. Let me confirm the service address.'],[first,address+'.'],['Maya','Thank you. What would you like the team to know?'],[first,'Please have the office update me when they can.'],['Maya','I have added that request for the team.']];
  if(category==='Estimate follow-up')return [open,[first,'I am calling because I am '+reason.toLowerCase()+'.'],['Maya','I can help capture the follow-up. What is the service address?'],[first,address+'.'],['Maya','What question would you like the estimator or office to address?'],[first,'I would like someone to review the estimate with me.'],['Maya','I will send that follow-up to the team.']];
  if(category==='Billing')return [open,[first,'I have a billing question: '+reason.toLowerCase()+'.'],['Maya','I can document the billing request for the office. Let me confirm the service address.'],[first,address+'.'],['Maya','Thank you. I will route this to the team that can review the account.']];
  if(category==='Complaint')return [open,[first,'I need to speak with someone because '+reason.toLowerCase()+'.'],['Maya','I am sorry you had that experience. I will document the issue carefully and flag it for priority follow-up.'],[first,'I would like a manager to call me back.'],['Maya','I have noted that request and will send it to the team.']];
  if(category==='Warranty')return [open,[first,'I have a warranty question about work your company completed.'],['Maya','I can capture the details for the service team. What is the address for the previous work?'],[first,address+'.'],['Maya','Thank you. I will route the warranty question for review.']];
  return [open,[first,'I am calling about '+reason.toLowerCase()+'.'],['Maya','Absolutely. What is the service address?'],[first,address+'.'],['Maya','How soon do you need service?'],[first,i%3===0?'Today if possible.':'Sometime this week.'],['Maya',outcome==='Resolved'?'I have the information you needed.':'I have everything I need and will send this to the service team.'],[first,'Thank you.']];
}

function makePrimaryDataset(){
  const calls=[],leads=[],conversations=[],appointments=[];
  let callIndex=0,leadIndex=0,apptIndex=0;
  for(let day=0;day<60;day++){
    const daily=18+((day*7)%5); // 18-22/day, ~20 average
    for(let j=0;j<daily;j++){
      const i=callIndex++,customerIndex=(i*13+day*7+(j%5===0?day:0))%180,person=nameFor(customerIndex),scenario=pick(WEIGHTED_SCENARIOS,i*7+day*3+j),reason=scenario.reason,category=scenario.category;
      let outcome=scenario.outcome;
      const customerCall=!['Wrong number','Spam','Vendor','Employment'].includes(category);
      if(customerCall&&(i+day)%17===0)outcome='Missed';
      const hour=7+((j*3+day)%11),minute=(j*17+day*7)%60,createdAt=dayAt(day,hour,minute);
      const value=outcome==='Missed'?0:Number(scenario.value||0);
      const id='call_'+String(i+1).padStart(4,'0'),city=pick(CITY_DATA,customerIndex),address=(210+((customerIndex*43)%7400))+' '+pick(STREETS,customerIndex*3)+', '+city[0]+', '+city[1]+' '+city[2],customerPhone=phoneFor(customerIndex),needsAddress=['New service','Existing job','Estimate follow-up','Billing','Complaint','Warranty'].includes(category),callAddress=needsAddress?address:'';
      calls.push({
        id,caller:person,phone:customerPhone,address:callAddress,category,reason,duration:outcome==='Missed'?'0:18':category==='Wrong number'?'0:42':category==='Spam'?'0:55':durationFor(i),outcome,
        agent:outcome==='Missed'?'Recovery':'Maya',time:timeLabel(createdAt),date:dateLabel(createdAt),createdAt,
        summary:outcome==='Missed'
          ?person+' disconnected before the call was completed. CallerCore queued the call for team follow-up.'
          :category==='Wrong number'
            ?person+' reached Summit Heating & Air by mistake. Maya identified the call as a wrong number and ended it politely.'
            :category==='Spam'
              ?person+' made an unsolicited sales call. Maya identified it as non-customer activity and no staff action was created.'
              :category==='Existing job'
                ?person+' called about an existing job: '+reason.toLowerCase()+'. Maya captured the update request for the office.'
                :category==='Complaint'
                  ?person+' called with a service complaint: '+reason.toLowerCase()+'. Maya documented the issue and flagged it for human follow-up.'
                  :person+' called about '+reason.toLowerCase()+'. Maya classified the call and captured the relevant details.',
        qualification:{'Call type':category,Intent:/Qualified/.test(outcome)?'High':outcome==='Resolved'?'Informational':'Medium',Service:reason,Timeline:(i%3===0?'Today':i%3===1?'This week':'This month'),Value:value?('$'+value.toLocaleString('en-US')):'—'},
        transcript:transcriptFor(person,category,reason,address,outcome,i)
      });
      if(!['Missed'].includes(outcome)&&['New service','Estimate follow-up'].includes(category)&&((i+day)%10<5)){
        const stage=outcome==='Qualified'?'Qualified':outcome==='Resolved'?'Won':'Contacted';
        const lead={id:'lead_'+String(++leadIndex).padStart(4,'0'),name:person,phone:customerPhone,address,service:reason,value:Math.max(180,value||350),stage,source:'AI call',age:day===0?((j+4)+'m'):(day+'d'),createdAt};
        leads.push(lead);
        if((i+day)%2===0){
          conversations.push({
            id:'conv_'+id,name:person,phone:customerPhone,address,status:stage==='Won'?'Closed':'Needs follow-up',
            last:stage==='Won'?'Question handled by CallerCore.':'Team follow-up requested after the call.',
            time:timeLabel(createdAt),createdAt,messages:[
              {who:'Maya',text:'Thanks for calling Summit Heating & Air today. I shared your request with the service team.',dir:'out',at:createdAt+60000},
              {who:person.split(' ')[0],text:stage==='Won'?'Perfect, thank you.':'Thanks — please have someone follow up with me.',dir:'in',at:createdAt+180000}
            ]
          });
        }
      }
    }
  }
  calls.sort((a,b)=>b.createdAt-a.createdAt);
  leads.sort((a,b)=>b.createdAt-a.createdAt);
  conversations.sort((a,b)=>b.createdAt-a.createdAt);
  appointments.sort((a,b)=>b.createdAt-a.createdAt);
  const currentMonthCalls=calls.filter(x=>new Date(x.createdAt).getMonth()===new Date().getMonth()).filter(x=>new Date(x.createdAt).getFullYear()===new Date().getFullYear());
  const minutes=Math.round(currentMonthCalls.reduce((n,c)=>{const p=String(c.duration||'0:00').split(':');return n+(Number(p[0])||0)+(Number(p[1])||0)/60},0));
  return {calls,leads,conversations,appointments,minutes};
}

function primaryWorkspace(workspaceId,email,now=Date.now()){
  return {
    id:workspaceId,name:'Summit Heating & Air',ownerName:'Daniel Carter',ownerEmail:email,phone:'(509) 555-0188',industry:'HVAC',
    plan:'Pro',status:'active',subscriptionStatus:'active',stripeCustomerId:null,stripeSubscriptionId:null,stripeCheckoutSessionId:null,
    usage:{minutes:0},createdAt:now-1000*60*60*24*210,updatedAt:now
  };
}
function primarySettings(email){
  return {
    businessName:'Summit Heating & Air',primaryEmail:email,contactName:'Daniel Carter',businessPhone:'(509) 555-0144',
    website:'https://summitheatingair.com',streetAddress:'1428 N Monroe St',city:'Spokane',state:'WA',postalCode:'99201',
    industry:'HVAC',serviceArea:'Spokane, Spokane Valley, Liberty Lake, Airway Heights, Cheney, and nearby communities.',
    timezone:'America/Los_Angeles',notificationEmail:email,emailAlerts:true,smsAlerts:false,
    notifyBilling:true,notifySetup:true,notifyCalls:true,notifySupport:true,notifyUsage:true,updatedAt:Date.now()
  };
}
function primaryAgent(){
  return {
    name:'Maya',role:'AI Receptionist',tone:'Warm & professional',
    openingMessage:'Thank you for calling Summit Heating & Air. This is Maya. How can I help you today?',
    serviceArea:'Spokane, Spokane Valley, Liberty Lake, Airway Heights, Cheney, and nearby communities.',
    businessHours:'Monday–Friday 7:30 AM–6:00 PM. Saturday 8:00 AM–2:00 PM. Emergency no-heat calls are accepted after hours.',
    transferNumber:'(509) 555-0144',
    emergencyInstructions:'For no-heat calls in freezing weather, active gas odors, or carbon monoxide concerns, prioritize safety instructions and urgent escalation to the on-call technician.',
    qualificationQuestions:['What issue are you experiencing?','What is the service address?','Is the system currently running?','How soon do you need service?','Are you the homeowner or authorized decision maker?'],
    updatedAt:Date.now()
  };
}
function primaryAutomations(){
  return [
    {id:'auto_missed',name:'Missed-call recovery',trigger:'missed_call',action:'create_followup',enabled:true},
    {id:'auto_hot',name:'Urgent HVAC lead alert',trigger:'qualified_lead',action:'notify_team',enabled:true},
    {id:'auto_afterhours',name:'After-hours escalation',trigger:'after_hours_call',action:'notify_team',enabled:true}
  ];
}
function primaryLocations(){
  return [
    {id:'loc_spokane',name:'Spokane',phone:'(509) 555-0144',address:'1428 N Monroe St, Spokane, WA 99201',timezone:'America/Los_Angeles',active:true},
    {id:'loc_valley',name:'Spokane Valley',phone:'(509) 555-0177',address:'9215 E Sprague Ave, Spokane Valley, WA 99206',timezone:'America/Los_Angeles',active:true}
  ];
}
function primaryPhone(workspaceId){
  return {id:'phone_'+workspaceId.slice(0,8),number:'(509) 555-0188',workspaceId,workspaceName:'Summit Heating & Air',provider:'Vapi',label:'Primary AI line',forwardingFrom:'(509) 555-0144',transferNumber:'(509) 555-0144',afterHours:'ai',smsEnabled:false,status:'active',updatedAt:Date.now()};
}

const ADMIN_CLIENTS=[
  ['North Ridge Plumbing','Growth','active','active',486,'Plumbing'],
  ['Pine & Peak Roofing','Pro','active','active',1120,'Roofing'],
  ['Riverbend Dental','Growth','active','active',392,'Dental'],
  ['Inland Garage Door','Starter','active','active',241,'Garage Door'],
  ['Clearwater Restoration','Pro','active','past_due',1385,'Restoration'],
  ['Lakeview Electric','Growth','onboarding','active',74,'Electrical'],
  ['Juniper Family Law','Growth','active','active',318,'Legal'],
  ['Stonecrest Landscaping','Starter','suspended','active',167,'Landscaping']
];
function adminWorkspace(idBase,index,now=Date.now()){
  const row=ADMIN_CLIENTS[index],id='seed_'+idBase+'_'+String(index+1).padStart(2,'0');
  return {id,name:row[0],ownerName:nameFor(index+80),ownerEmail:'owner'+(index+1)+'@example-client.test',phone:'(509) 555-'+String(2200+index*17).padStart(4,'0'),
    industry:row[5],plan:row[1],status:row[2],subscriptionStatus:row[3],stripeCustomerId:'seed_customer_'+(index+1),stripeSubscriptionId:'seed_sub_'+(index+1),
    usage:{minutes:row[4]},createdAt:now-86400000*(35+index*18),updatedAt:now-3600000*index};
}
function adminSeedCalls(index,workspaceName){
  const count=24+index*9,items=[];
  for(let i=0;i<count;i++){
    const ts=dayAt(i%28,8+(i%9),(i*11)%60),scenario=pick(WEIGHTED_SCENARIOS,i+index*3),category=scenario.category,reason=scenario.reason;
    let outcome=scenario.outcome;
    if(!['Wrong number','Spam','Vendor','Employment'].includes(category)&&i%11===0)outcome='Missed';
    items.push({id:'adminseed_'+index+'_'+i,caller:nameFor(i+index*11),phone:phoneFor(i+index*17),category,reason,duration:outcome==='Missed'?'0:18':durationFor(i+index),outcome,agent:'Maya',time:timeLabel(ts),date:dateLabel(ts),createdAt:ts,workspaceName});
  }
  return items.sort((a,b)=>b.createdAt-a.createdAt);
}
function adminSeedLeads(index){
  const serviceScenarios=CALL_SCENARIOS.filter(x=>['New service','Estimate follow-up'].includes(x.category));
  const items=[];
  for(let i=0;i<12+index*3;i++){
    const scenario=pick(serviceScenarios,i+index);
    items.push({id:'adminlead_'+index+'_'+i,name:nameFor(120+i+index*5),phone:phoneFor(200+i+index*7),service:scenario.reason,value:Number(scenario.value||500),stage:pick(STAGES,i+index),source:i%4===0?'Website':'AI call',age:(i+1)+'d',createdAt:dayAt(i%30,10,0)});
  }
  return items;
}
function adminSeedAgent(industry){
  return {name:'Maya',role:'AI Receptionist',tone:'Warm & professional',openingMessage:'Thank you for calling. This is Maya. How can I help you today?',serviceArea:'Spokane metro and surrounding communities.',businessHours:'Monday–Friday 8 AM–5 PM',emergencyInstructions:'Escalate urgent requests to the on-call team.',qualificationQuestions:['How can we help?','What is your location?','How soon do you need service?'],transferNumber:'(509) 555-0100',industry,updatedAt:Date.now()};
}

module.exports={makePrimaryDataset,primaryWorkspace,primarySettings,primaryAgent,primaryAutomations,primaryLocations,primaryPhone,ADMIN_CLIENTS,adminWorkspace,adminSeedCalls,adminSeedLeads,adminSeedAgent};
