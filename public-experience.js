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
  function estimateMinutes(calls,minutes){
    const c=Number(calls),m=Number(minutes);
    if(!Number.isFinite(c)||!Number.isFinite(m))return null;
    return Math.round(Math.min(100,Math.max(5,c))*Math.min(8,Math.max(1,m))*4.33);
  }
  function createPlayback({count,onChange,schedule=setTimeout,cancel=clearTimeout}){
    let step=0,playing=false,timer=null,generation=0;
    const clear=()=>{generation++;if(timer!==null)cancel(timer);timer=null};
    const emit=()=>onChange({step,playing});
    const queue=()=>{const token=generation;timer=schedule(()=>{if(token!==generation||!playing)return;timer=null;step=Math.min(count-1,step+1);if(step===count-1)playing=false;emit();if(playing)queue()},6500)};
    return {
      reset(){clear();step=0;playing=false;emit()},
      next(){clear();playing=false;step=(step+1)%count;emit()},
      toggle(){clear();playing=!playing;if(playing&&step===count-1)step=0;emit();if(playing)queue()},
      pause(){clear();playing=false;emit()}
    };
  }
  if(typeof module==='object'&&module.exports){module.exports={scenarios,estimateMinutes,createPlayback};return}
  const doc=root.document;
  if(!doc)return;
  const byId=id=>doc.getElementById(id);
  const conversation=byId('demoConversation');
  if(conversation){
    let selected='emergency';
    const motion=root.matchMedia('(prefers-reduced-motion: reduce)');
    const playback=createPlayback({count:4,onChange:({step,playing})=>{
      const scenario=scenarios[selected],moment=scenario.moments[step];
      conversation.querySelector('.customer p').textContent=moment[0];
      conversation.querySelector('.agent p').textContent=moment[1];
      byId('demoIntent').textContent=scenario.intent;
      byId('demoUrgency').textContent=scenario.urgency;
      byId('demoNext').textContent=moment[2];
      byId('demoProgress').textContent=`${step+1} of 4 moments`;
      byId('demoTrack').style.width=`${(step+1)*25}%`;
      byId('demoPlay').textContent=playing?'Pause walkthrough':step===3?'Replay walkthrough':'Play walkthrough';
      byId('demoPlay').setAttribute('aria-pressed',String(playing));
      byId('demoNextButton').textContent=step===3?'Start again ↻':'Next moment →';
      if(!motion.matches&&conversation.animate)conversation.animate([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:220});
    }});
    doc.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
      if(!Object.hasOwn(scenarios,button.dataset.demo))return;
      selected=button.dataset.demo;
      doc.querySelectorAll('[data-demo]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});
      playback.reset();
    }));
    byId('demoPlay').addEventListener('click',()=>playback.toggle());
    byId('demoNextButton').addEventListener('click',()=>playback.next());
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden)playback.pause()});
    root.addEventListener('pagehide',()=>playback.pause());
    motion.addEventListener?.('change',()=>playback.pause());
  }
  const calls=byId('weeklyCalls'),length=byId('callLength');
  if(calls&&length){
    const update=()=>{
      const minutes=estimateMinutes(calls.value,length.value);if(minutes===null)return;
      byId('weeklyCallsValue').textContent=calls.value;
      byId('callLengthValue').textContent=length.value+' '+(Number(length.value)===1?'minute':'minutes');
      byId('monthlyMinutes').textContent=minutes.toLocaleString('en-US');
      const max=Math.max(600,minutes);
      byId('estimateBar').style.width=`${minutes/max*100}%`;
      byId('starterBar').style.width=`${300/max*100}%`;
      byId('growthBar').style.width=`${600/max*100}%`;
      byId('planSuggestion').textContent=minutes<=300?'Within Starter’s 300 included minutes.':minutes<=600?'Above Starter’s included minutes; within Growth’s 600.':'Above Growth’s 600 included minutes. Talk to us about expected usage and plan options.';
    };
    calls.addEventListener('input',update);length.addEventListener('input',update);update();
  }
})(typeof window==='object'?window:globalThis);
