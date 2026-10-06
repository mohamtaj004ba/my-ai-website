/* Public examples use local illustrative data. No calls, customer data, or provider actions. */
(function(root){
  'use strict';
  const scenarios={
    emergency:{intent:'Urgent repair',urgency:'High',moments:[
      ['Hi, my furnace stopped working. It’s getting pretty cold in here.','I’m sorry to hear that. I can take the details for a callback. What’s your name?','Collect contact details'],
      ['I’m Alex. You can call me back on this number.','Thanks, Alex. What’s the service address?','Confirm service location'],
      ['42 Maple Street. The furnace won’t turn on at all.','Got it. I’ll include that it won’t turn on and that the house is getting cold. Is there anything else you’d like me to pass along?','Capture the problem'],
      ['That’s everything. Please have someone call as soon as they can.','I’ll include that in your message, Alex. Thanks for calling.','Priority callback requested']
    ]},
    booking:{intent:'Service request',urgency:'Normal',moments:[
      ['Hi, I’d like someone to service my air conditioner.','Of course. Is this a routine service, or is something not working?','Understand the request'],
      ['Just a service before summer. It’s working fine.','Great. What’s your name and the best number to reach you?','Collect contact details'],
      ['Sam. This number is fine. Are you free on Friday?','I can note Friday as your preference. Would morning or afternoon work better?','Capture preferred time'],
      ['Afternoon, please.','Thanks, Sam. I’ve noted Friday afternoon. Someone will need to confirm a time with you.','Friday afternoon requested']
    ]},
    human:{intent:'Estimate request',urgency:'Normal',moments:[
      ['Could I speak to someone about an estimate?','Sure. Is this about an estimate you already received, or a new project?','Understand the request'],
      ['You sent me one last week for a roof repair.','Thanks. What name is the estimate under?','Identify the estimate'],
      ['Jordan Lee. I have a question about the materials.','Got it, Jordan. What’s the best number for someone to call you back?','Confirm callback number'],
      ['This number. After three would be best.','I’ll pass along your question and that you’re available after three. Thanks, Jordan.','Callback after 3 requested']
    ]}
  };
  Object.assign(scenarios,{"professional":{"intent":"Consultation inquiry","urgency":"Normal","moments":[["Hi, I’m looking for bookkeeping help for a new business.","Of course. What kind of business are you starting?","Understand the business"],["A design studio. I need help getting the accounts set up.","Thanks. What’s your name and a good callback number?","Capture contact details"],["Sarah Mitchell. You can use this number.","Got it, Sarah. When would be a good time for someone to call?","Capture availability"],["Tomorrow afternoon would be great.","I’ll include your request and preferred time for the team to follow up.","Consultation callback requested"]]},"medical":{"intent":"Appointment request","urgency":"Normal","moments":[["Hi, I need to reschedule an appointment.","I can take a message for the scheduling team. What name is the appointment under?","Identify the appointment"],["Jamie Morgan. It’s currently on Thursday.","Thank you. What’s the best number for the team to reach you?","Capture callback number"],["This number. Could we do next Monday instead?","I can note Monday as your preference. Morning or afternoon?","Capture preferred time"],["Morning, please.","I’ll pass that to the scheduling team. They’ll need to confirm the change with you.","Rescheduling request prepared"]]},"legal":{"intent":"New client inquiry","urgency":"Normal","moments":[["Hi, I’d like to speak with someone about a contract.","I can take your contact details for the intake team. What’s your name?","Capture caller name"],["Taylor Reed. It’s for a new business partnership.","Thank you. What number should the team call you on?","Capture contact details"],["This number is fine. I’m free after two.","I’ll note that. Is there anything brief you’d like included in the callback request?","Capture preferred time"],["I want someone to review it before I sign.","I’ll pass your request to the team so they can discuss the next steps with you.","Intake callback requested"]]},"property":{"intent":"Maintenance request","urgency":"High","moments":[["Hi, the heating isn’t working in my apartment.","I can collect the details for the property team. What’s the property address and unit?","Identify the property"],["18 Oak Street, apartment 4.","Thanks. What’s your name and callback number?","Capture contact details"],["Alex Brooks. This number is fine.","Is the heating completely off, and when did you notice it?","Capture maintenance details"],["It stopped this morning.","I’ll include those details in the maintenance request for your property team.","Maintenance follow-up prepared"]]},"automotive":{"intent":"Vehicle service request","urgency":"Normal","moments":[["Can I get a brake inspection this week?","I can take a service request. What vehicle do you have?","Capture vehicle details"],["A 2021 Toyota Camry.","Thank you. What’s your name and best callback number?","Capture contact details"],["Chris Lee. You can use this number.","What day would work best for you?","Capture preferred date"],["Friday morning.","I’ll include Friday morning as your preference. The team will need to confirm availability.","Inspection request prepared"]]}});
  function estimateMinutes(calls,minutes){
    const c=Number(calls),m=Number(minutes);
    if(!Number.isFinite(c)||!Number.isFinite(m))return null;
    return Math.round(Math.min(100,Math.max(5,c))*Math.min(8,Math.max(1,m))*4.33);
  }
  function estimateMonthlyMinutes(calls,minutes){
    const c=Number(calls),m=Number(minutes);
    if(!Number.isFinite(c)||!Number.isFinite(m)||c<0||m<=0)return null;
    return Math.round(c*m);
  }
  function createPlayback({count,onChange,interval=6500,loop=false,schedule=setTimeout,cancel=clearTimeout}){
    let step=0,playing=false,timer=null,generation=0;
    const clear=()=>{generation++;if(timer!==null)cancel(timer);timer=null};
    const emit=()=>onChange({step,playing});
    const queue=()=>{const token=generation;timer=schedule(()=>{if(token!==generation||!playing)return;timer=null;step=loop?(step+1)%count:Math.min(count-1,step+1);if(step===count-1&&!loop)playing=false;emit();if(playing)queue()},interval)};
    return {
      reset(){clear();step=0;playing=false;emit()},
      next(){clear();playing=false;step=(step+1)%count;emit()},
      toggle(){clear();playing=!playing;if(playing&&step===count-1)step=0;emit();if(playing)queue()},
      pause(){clear();playing=false;emit()}
    };
  }
  if(typeof module==='object'&&module.exports){module.exports={scenarios,estimateMinutes,estimateMonthlyMinutes,createPlayback};return}
  const doc=root.document;
  if(!doc)return;
  const byId=id=>doc.getElementById(id);
  const conversation=byId('demoConversation');
  if(conversation){
    let selected='professional';
    const motion=root.matchMedia('(prefers-reduced-motion: reduce)');
    const playback=createPlayback({count:4,interval:4600,loop:true,onChange:({step,playing})=>{
      const scenario=scenarios[selected],moment=scenario.moments[step];
      conversation.querySelector('.customer p').textContent=moment[0];
      conversation.querySelector('.agent p').textContent=moment[1];
      byId('demoIntent').textContent=scenario.intent;
      byId('demoUrgency').textContent=scenario.urgency;
      byId('demoNext').textContent=moment[2];
      byId('demoProgress').textContent=['Listening to the caller','Understanding the request','Capturing the details','Ready for your team'][step];
      const stage=conversation.closest('.live-stage');
      stage.dataset.step=String(step);stage.dataset.playing=String(playing);
      doc.querySelectorAll('.call-journey li').forEach((item,i)=>{item.classList.toggle('current',i===step);item.classList.toggle('complete',i<step)});
      const payoff=byId('demoPayoff');if(payoff)payoff.hidden=step!==3;
      byId('demoTrack').style.width=`${(step+1)*25}%`;
      byId('demoPlay').textContent=playing?'Pause animation':'Resume animation';
      byId('demoPlay').setAttribute('aria-pressed',String(playing));
      byId('demoNextButton').textContent=step===3?'Start again ↻':'Next moment →';
      if(!motion.matches){
        conversation.querySelectorAll('.demo-line').forEach((line,i)=>line.animate?.([{opacity:0,transform:'translateY(18px) scale(.97)'},{opacity:1,transform:'none'}],{duration:500,delay:i*650,fill:'backwards'}));
        doc.querySelector('.demo-outcome').animate?.([{opacity:.25,transform:'translateX(12px)'},{opacity:1,transform:'none'}],{duration:550,delay:1000,fill:'backwards'});
      }
    }});
    doc.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
      if(!Object.hasOwn(scenarios,button.dataset.demo))return;
      selected=button.dataset.demo;
      doc.querySelectorAll('[data-demo]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});
      playback.reset();
      if(!motion.matches)playback.toggle();
    }));
    byId('demoPlay').addEventListener('click',()=>playback.toggle());
    if ('IntersectionObserver' in root && !motion.matches) {
      let introduced=false;
      const observer=new root.IntersectionObserver(entries=>{
        if(entries[0].isIntersecting&&!introduced){introduced=true;playback.toggle()}
        else if(!entries[0].isIntersecting)playback.pause();
      },{threshold:.15});
      observer.observe(conversation.closest('.live-stage'));
    }
    byId('demoNextButton').addEventListener('click',()=>playback.next());
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden)playback.pause()});
    root.addEventListener('pagehide',()=>playback.pause());
    motion.addEventListener?.('change',()=>playback.pause());
  }
  const calls=byId('monthlyCalls'),length=byId('callLength');
  if(calls&&length){
    const update=()=>{
      const minutes=estimateMonthlyMinutes(calls.value,length.value);if(minutes===null)return;
      byId('monthlyCallsValue').textContent=calls.value;
      byId('callLengthValue').textContent=length.value+' '+(Number(length.value)===1?'minute':'minutes');
      byId('monthlyMinutes').textContent=minutes.toLocaleString('en-US');
      byId('callCapacity').textContent=`At ${length.value} minutes per call, 300 minutes covers about ${Math.floor(300/Number(length.value))} calls; 600 minutes about ${Math.floor(600/Number(length.value))}. Included minutes are a time allowance, not a fixed call limit.`;
      const max=Math.max(600,minutes);
      byId('estimateBar').style.width=`${minutes/max*100}%`;
      byId('starterBar').style.width=`${300/max*100}%`;
      byId('growthBar').style.width=`${600/max*100}%`;
      byId('planSuggestion').textContent=minutes<=300?'Within Starter’s 300 included minutes.':minutes<=600?'Above Starter’s included minutes; within Growth’s 600.':'Above Growth’s 600 included minutes. Talk to us about expected usage and plan options.';
    };
    calls.addEventListener('input',update);length.addEventListener('input',update);update();
  }
})(typeof window==='object'?window:globalThis);
