const DEFAULT_TIME_ZONE='America/Los_Angeles';
const DEFAULT_OPEN_HOUR=9;
const DEFAULT_CLOSE_HOUR=17;

function localParts(date,timeZone=DEFAULT_TIME_ZONE){
  return new Intl.DateTimeFormat('en-US',{
    timeZone,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false
  }).formatToParts(date).reduce((a,p)=>(a[p.type]=p.value,a),{});
}
function isBusinessDay(day){return day!=='Sat'&&day!=='Sun'}
function advanceToBusinessOpen(input,{timeZone=DEFAULT_TIME_ZONE,openHour=DEFAULT_OPEN_HOUR,closeHour=DEFAULT_CLOSE_HOUR}={}){
  let d=new Date(input),guard=0;
  while(guard++<14){
    const p=localParts(d,timeZone),day=p.weekday,h=Number(p.hour),m=Number(p.minute);
    if(isBusinessDay(day)&&h>=openHour&&h<closeHour)return d;
    const addDays=day==='Sat'?2:day==='Sun'?1:(h>=closeHour?1:0);
    const x=new Date(d.getTime()+addDays*86400000),q=localParts(x,timeZone);
    x.setTime(x.getTime()+((openHour-Number(q.hour))*60-Number(q.minute))*60000);
    d=x;
  }
  return d;
}
function addBusinessHours(startMs,hours,options={}){
  const timeZone=options.timeZone||DEFAULT_TIME_ZONE,openHour=options.openHour??DEFAULT_OPEN_HOUR,closeHour=options.closeHour??DEFAULT_CLOSE_HOUR;
  let remaining=Math.max(0,Number(hours||0))*3600000,t=advanceToBusinessOpen(new Date(startMs),{timeZone,openHour,closeHour});
  while(remaining>0){
    const p=localParts(t,timeZone),minsLeft=Math.max(0,closeHour*60-(Number(p.hour)*60+Number(p.minute))),windowMs=minsLeft*60000;
    if(remaining<=windowMs){t=new Date(t.getTime()+remaining);remaining=0;break}
    remaining-=windowMs;
    t=advanceToBusinessOpen(new Date(t.getTime()+windowMs+16*3600000),{timeZone,openHour,closeHour});
  }
  return t.getTime();
}
module.exports={DEFAULT_TIME_ZONE,DEFAULT_OPEN_HOUR,DEFAULT_CLOSE_HOUR,localParts,isBusinessDay,advanceToBusinessOpen,addBusinessHours};
