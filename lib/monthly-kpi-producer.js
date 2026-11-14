const {PLANS}=require('./plans');
const {monthKey,monthlyKpiStorageKey,recordMonthlyKpiSnapshot}=require('./monthly-kpi-rollup');
const {ensureStripeMonthlyMetricsCoverage,readStripeMonthlyPaymentFailures}=require('./stripe-monthly-metrics');

const WORKSPACE_LIMIT=2000,SESSION_LIMIT=2000,PROSPECT_LIMIT=2000,EVENT_LIMIT=5000,SUPPORT_LIMIT=2000;
const CALL_OUTCOME_KEYS={resolved_by_ai:'resolvedByAi',request_captured:'requestCaptured',message_taken:'messageTaken',transferred:'transferred',escalated:'escalated',incomplete:'incomplete',non_customer:'nonCustomer'};

function monthWindow(now=Date.now()){
  const d=new Date(Number(now));if(!Number.isFinite(d.getTime()))throw new Error('Monthly KPI producer time is invalid');
  const start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1),end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
  return {month:monthKey(d),start,end};
}
function inWindow(value,start,end){const n=Number(value);return Number.isFinite(n)&&n>=start&&n<end}
function validIds(raw,max){
  if(raw==null)return [];
  if(!Array.isArray(raw)||raw.length>max)return null;
  const ids=raw.map(id=>String(id||'').trim());
  if(ids.some(id=>!id)||new Set(ids).size!==ids.length)return null;
  return ids;
}
function parseDurationSeconds(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
  const text=String(value??'').trim();if(!text)return null;
  if(/^\d+(?:\.\d+)?$/.test(text)){const n=Number(text);return Number.isFinite(n)&&n>=0?n:null}
  const parts=text.split(':');if(parts.length!==2&&parts.length!==3)return null;
  if(parts.some((part,i)=>!/^\d+$/.test(part)||(i>0&&Number(part)>=60)))return null;
  if(parts.length===2)return Number(parts[0])*60+Number(parts[1]);
  return Number(parts[0])*3600+Number(parts[1])*60+Number(parts[2]);
}
function dispositionKey(value){
  const key=String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
  return CALL_OUTCOME_KEYS[key]||'';
}
async function loadRecords(kv,ids,prefix,{batchSize=80}={}){
  const records=[];
  for(let offset=0;offset<ids.length;offset+=batchSize){
    const slice=ids.slice(offset,offset+batchSize),batch=await Promise.all(slice.map(id=>kv.get(prefix+id)));
    for(let i=0;i<slice.length;i++){
      const record=batch[i];
      if(!record||typeof record!=='object'||Array.isArray(record)||String(record.id||'')!==slice[i])return {ok:false,records:[]};
      records.push(record);
    }
  }
  return {ok:true,records};
}
async function scanRecentIndexed(kv,rawIds,prefix,dateField,start,max){
  const ids=validIds(rawIds,max);if(ids===null)return {ok:false,records:[],reason:'index'};
  const records=[],seenBoundary={value:false};
  for(let offset=0;offset<ids.length&&!seenBoundary.value;offset+=80){
    const slice=ids.slice(offset,offset+80),batch=await Promise.all(slice.map(id=>kv.get(prefix+id)));
    for(let i=0;i<slice.length;i++){
      const record=batch[i];
      if(!record||typeof record!=='object'||Array.isArray(record)||String(record.id||'')!==slice[i])return {ok:false,records:[],reason:'record'};
      const at=Number(record[dateField]);if(!Number.isFinite(at)||at<=0)return {ok:false,records:[],reason:'timestamp'};
      if(at<start){seenBoundary.value=true;break}
      records.push(record);
    }
  }
  if(ids.length>=max&&!seenBoundary.value)return {ok:false,records:[],reason:'retention_cap'};
  return {ok:true,records};
}
function scanRecentEvents(raw,start){
  if(!Array.isArray(raw))return {ok:false,records:[],reason:'index'};
  const records=[];let boundary=false;
  for(const event of raw){
    if(!event||typeof event!=='object'||Array.isArray(event))return {ok:false,records:[],reason:'record'};
    const at=Number(event.at);if(!Number.isFinite(at)||at<=0)return {ok:false,records:[],reason:'timestamp'};
    if(at<start){boundary=true;break}
    records.push(event);
  }
  if(raw.length>=EVENT_LIMIT&&!boundary)return {ok:false,records:[],reason:'retention_cap'};
  return {ok:true,records};
}
function emptyCoverage(){return {websiteEvents:false,websiteSessions:false,websiteVisitors:false,leadPipeline:false,workspaces:false,conversions:false,churn:false,calls:false,callMinutes:false,callOutcomes:false,appointments:false,support:false,paymentFailures:false}}
function pushIssue(issues,domain,reason){issues.push({domain,reason:String(reason||'unavailable').slice(0,80)})}

async function buildMonthlyKpiSnapshot(kv,{now=Date.now()}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.lrange!=='function')throw new Error('Monthly KPI producer storage is unavailable');
  const recordedAt=Number(now),{month,start,end}=monthWindow(recordedAt),coverage=emptyCoverage(),issues=[];
  const snapshot={month,recordedAt,sessions:null,visitors:null,pageViews:null,leads:null,conversions:null,churnedClients:null,calls:null,minutes:null,appointments:null,transfers:null,paymentFailures:null,supportTickets:null,mrr:null,arr:null,setupRevenue:null,conversionRate:null,planMix:null,callOutcomes:null,coverage};

  let workspaceRecords=[];
  try{
    const raw=await kv.get('workspace:index'),ids=validIds(raw,WORKSPACE_LIMIT);
    if(ids===null)pushIssue(issues,'workspaces','index');
    else{
      const loaded=await loadRecords(kv,ids,'workspace:');
      if(!loaded.ok)pushIssue(issues,'workspaces','record');
      else if(loaded.records.some(ws=>!PLANS[ws.plan]))pushIssue(issues,'workspaces','plan');
      else{
        workspaceRecords=loaded.records;coverage.workspaces=true;
        const billable=workspaceRecords.filter(ws=>String(ws.subscriptionStatus||'active')!=='canceled'&&String(ws.status||'active')!=='pending_deletion');
        const planMix={Starter:0,Growth:0,Pro:0};let mrr=0;
        for(const ws of billable){planMix[ws.plan]++;mrr+=Number(PLANS[ws.plan].price||0)}
        snapshot.mrr=mrr;snapshot.arr=mrr*12;snapshot.planMix=planMix;

        let conversionSafe=true,conversionCount=0,setupRevenue=0;
        for(const ws of workspaceRecords){
          const conversion=ws.conversion;
          if(conversion==null)continue;
          if(!conversion||typeof conversion!=='object'||Array.isArray(conversion)){conversionSafe=false;break}
          const paidAt=Number(conversion.firstPaidAt||0);
          if(paidAt&&inWindow(paidAt,start,end)){
            const setup=Number(conversion.setupValue);
            if(!Number.isFinite(setup)||setup<0){conversionSafe=false;break}
            conversionCount++;setupRevenue+=setup;
          }
        }
        if(conversionSafe){coverage.conversions=true;snapshot.conversions=conversionCount;snapshot.setupRevenue=Math.round(setupRevenue*100)/100}
        else pushIssue(issues,'conversions','metadata');

        const canceled=workspaceRecords.filter(ws=>String(ws.subscriptionStatus||'')==='canceled');
        const churnSafe=canceled.every(ws=>Number.isFinite(Number(ws.stripeBilling?.canceledAt))&&Number(ws.stripeBilling.canceledAt)>0);
        if(churnSafe){coverage.churn=true;snapshot.churnedClients=canceled.filter(ws=>inWindow(ws.stripeBilling.canceledAt,start,end)).length}
        else pushIssue(issues,'churn','canceled_at');
      }
    }
  }catch(err){pushIssue(issues,'workspaces','storage')}

  try{
    const raw=await kv.lrange('site:events',0,EVENT_LIMIT-1),scan=scanRecentEvents(raw,start);
    if(scan.ok){coverage.websiteEvents=true;snapshot.pageViews=scan.records.filter(event=>event.type==='page_view'&&inWindow(event.at,start,end)).length}
    else pushIssue(issues,'websiteEvents',scan.reason);
  }catch(err){pushIssue(issues,'websiteEvents','storage')}

  try{
    const ids=await kv.lrange('site:session:index',0,SESSION_LIMIT-1),scan=await scanRecentIndexed(kv,ids,'site:session:','firstAt',start,SESSION_LIMIT);
    if(scan.ok){
      coverage.websiteSessions=true;snapshot.sessions=scan.records.filter(session=>inWindow(session.firstAt,start,end)).length;
      const current=scan.records.filter(session=>inWindow(session.firstAt,start,end));
      if(current.every(session=>String(session.visitorId||'').trim())){coverage.websiteVisitors=true;snapshot.visitors=new Set(current.map(session=>String(session.visitorId))).size}
      else pushIssue(issues,'websiteVisitors','visitor_id');
    }else pushIssue(issues,'websiteSessions',scan.reason);
  }catch(err){pushIssue(issues,'websiteSessions','storage')}

  try{
    const ids=await kv.lrange('site:prospect:index',0,PROSPECT_LIMIT-1),scan=await scanRecentIndexed(kv,ids,'site:prospect:','createdAt',start,PROSPECT_LIMIT);
    if(scan.ok){coverage.leadPipeline=true;snapshot.leads=scan.records.filter(prospect=>inWindow(prospect.createdAt,start,end)).length}
    else pushIssue(issues,'leadPipeline',scan.reason);
  }catch(err){pushIssue(issues,'leadPipeline','storage')}

  if(coverage.leadPipeline&&coverage.conversions&&snapshot.leads>0)
    snapshot.conversionRate=Math.round((snapshot.conversions/snapshot.leads)*10000)/100;

  if(coverage.workspaces){
    let callsSafe=true,minutesSafe=true,outcomesSafe=true,callCount=0,totalSeconds=0;
    const outcomes={resolvedByAi:0,requestCaptured:0,messageTaken:0,transferred:0,escalated:0,incomplete:0,nonCustomer:0};
    try{
      for(let offset=0;offset<workspaceRecords.length;offset+=30){
        const batch=workspaceRecords.slice(offset,offset+30);
        const rows=await Promise.all(batch.map(async ws=>{
          const compact=await kv.get('calls:index:'+ws.id);
          if(compact!=null){if(!Array.isArray(compact))return {ok:false};return {ok:true,calls:compact}}
          const full=await kv.get('calls:'+ws.id);if(full!=null&&!Array.isArray(full))return {ok:false};return {ok:true,calls:full||[]};
        }));
        for(const row of rows){
          if(!row.ok){callsSafe=false;break}
          for(const call of row.calls){
            if(!call||typeof call!=='object'||Array.isArray(call)){callsSafe=false;break}
            const at=Number(call.createdAt);if(!Number.isFinite(at)||at<=0){callsSafe=false;break}
            if(!inWindow(at,start,end))continue;
            callCount++;
            const seconds=parseDurationSeconds(call.duration);if(seconds==null)minutesSafe=false;else totalSeconds+=seconds;
            const key=dispositionKey(call.disposition);if(!key)outcomesSafe=false;else outcomes[key]++;
          }
          if(!callsSafe)break;
        }
        if(!callsSafe)break;
      }
    }catch(err){callsSafe=false;pushIssue(issues,'calls','storage')}
    if(callsSafe){
      coverage.calls=true;snapshot.calls=callCount;
      if(minutesSafe){coverage.callMinutes=true;snapshot.minutes=Math.round(totalSeconds/60)}else pushIssue(issues,'callMinutes','duration');
      if(outcomesSafe){coverage.callOutcomes=true;snapshot.callOutcomes=outcomes;snapshot.transfers=outcomes.transferred}else pushIssue(issues,'callOutcomes','disposition');
    }else if(!issues.some(x=>x.domain==='calls'))pushIssue(issues,'calls','record');

    let appointmentsSafe=true,appointmentCount=0;
    try{
      for(let offset=0;offset<workspaceRecords.length;offset+=40){
        const batch=await Promise.all(workspaceRecords.slice(offset,offset+40).map(ws=>kv.get('appointments:'+ws.id)));
        for(const items of batch){
          if(items!=null&&!Array.isArray(items)){appointmentsSafe=false;break}
          for(const item of items||[]){
            if(!item||typeof item!=='object'||Array.isArray(item)||!Number.isFinite(Number(item.createdAt))||Number(item.createdAt)<=0){appointmentsSafe=false;break}
            if(inWindow(item.createdAt,start,end))appointmentCount++;
          }
          if(!appointmentsSafe)break;
        }
        if(!appointmentsSafe)break;
      }
    }catch(err){appointmentsSafe=false}
    if(appointmentsSafe){coverage.appointments=true;snapshot.appointments=appointmentCount}else pushIssue(issues,'appointments','record_or_storage');
  }else{
    pushIssue(issues,'calls','workspace_dependency');pushIssue(issues,'appointments','workspace_dependency');
  }

  try{
    const raw=await kv.get('support:index'),ids=validIds(raw,SUPPORT_LIMIT);
    if(ids===null)pushIssue(issues,'support','index');
    else{
      const loaded=await loadRecords(kv,ids,'support:');
      if(!loaded.ok)pushIssue(issues,'support','record');
      else if(loaded.records.some(ticket=>!Number.isFinite(Number(ticket.createdAt))||Number(ticket.createdAt)<=0))pushIssue(issues,'support','timestamp');
      else{coverage.support=true;snapshot.supportTickets=loaded.records.filter(ticket=>inWindow(ticket.createdAt,start,end)).length}
    }
  }catch(err){pushIssue(issues,'support','storage')}

  try{
    const paymentFailures=await readStripeMonthlyPaymentFailures(kv,month,start);
    if(paymentFailures.complete){coverage.paymentFailures=true;snapshot.paymentFailures=paymentFailures.count}
    else pushIssue(issues,'paymentFailures',paymentFailures.reason||'partial_month');
  }catch(err){pushIssue(issues,'paymentFailures','metric_storage')}

  return {snapshot,issues};
}

async function refreshMonthlyKpiSnapshot(kv,{now=Date.now(),minIntervalMs=15*60*1000}={}){
  const recordedAt=Number(now),month=monthKey(recordedAt),key=monthlyKpiStorageKey(month),interval=Math.max(0,Math.min(24*60*60*1000,Number(minIntervalMs)||0));
  const existing=await kv.get(key);
  if(existing&&typeof existing==='object'&&!Array.isArray(existing)&&existing.month===month&&Number(existing.recordedAt||0)>0&&recordedAt-Number(existing.recordedAt)<interval)
    return {saved:false,cached:true,degraded:false,snapshot:existing,issues:[]};
  await ensureStripeMonthlyMetricsCoverage(kv,recordedAt);
  const built=await buildMonthlyKpiSnapshot(kv,{now:recordedAt});
  const result=await recordMonthlyKpiSnapshot(kv,built.snapshot);
  return {...result,cached:false,issues:built.issues};
}

module.exports={CALL_OUTCOME_KEYS,monthWindow,parseDurationSeconds,dispositionKey,buildMonthlyKpiSnapshot,refreshMonthlyKpiSnapshot};
