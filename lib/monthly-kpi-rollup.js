const {compareAndSetConfig}=require('./config-transaction');

const MONTHLY_KPI_INDEX_KEY='analytics:monthly:index';
const MAX_MONTHLY_KPI_MONTHS=240;
const INTEGER_FIELDS=['sessions','visitors','pageViews','leads','conversions','churnedClients','calls','minutes','appointments','transfers','paymentFailures','supportTickets'];
const MONEY_FIELDS=['mrr','arr','setupRevenue'];
const COVERAGE_FIELDS=['websiteEvents','websiteSessions','websiteVisitors','leadPipeline','workspaces','churn','calls','callMinutes','callOutcomes','appointments','support','paymentFailures'];
const ALLOWED_KEYS=new Set(['month','recordedAt',...INTEGER_FIELDS,...MONEY_FIELDS,'conversionRate','planMix','callOutcomes','coverage']);

function monthKey(value){
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))throw new Error('Monthly KPI date is invalid');
  return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0');
}
function validMonth(month){return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||''))}
function boundedCount(value,field){
  if(value==null)return null;
  const n=Number(value);if(!Number.isFinite(n)||n<0||!Number.isInteger(n)||n>1e12)throw new Error('Invalid monthly KPI '+field);return n;
}
function boundedMoney(value,field){
  if(value==null)return null;
  const n=Number(value);if(!Number.isFinite(n)||n<0||n>1e15)throw new Error('Invalid monthly KPI '+field);return Math.round(n*100)/100;
}
function cleanCountMap(value,field,allowedKeys){
  if(value==null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid monthly KPI '+field);
  const out={};
  for(const [key,raw] of Object.entries(value)){
    if(!allowedKeys.includes(key))throw new Error('Unexpected monthly KPI '+field+' key');
    out[key]=boundedCount(raw,field+'.'+key);
  }
  return out;
}
function sanitizeMonthlyKpiSnapshot(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Monthly KPI snapshot is invalid');
  for(const key of Object.keys(raw))if(!ALLOWED_KEYS.has(key))throw new Error('Unexpected monthly KPI field: '+key);
  const month=String(raw.month||'');if(!validMonth(month))throw new Error('Monthly KPI month is invalid');
  const recordedAt=Number(raw.recordedAt);if(!Number.isFinite(recordedAt)||recordedAt<=0)throw new Error('Monthly KPI recordedAt is invalid');
  const out={month,recordedAt};
  for(const field of INTEGER_FIELDS)out[field]=boundedCount(raw[field],field);
  for(const field of MONEY_FIELDS)out[field]=boundedMoney(raw[field],field);
  if(raw.conversionRate==null)out.conversionRate=null;
  else{const rate=Number(raw.conversionRate);if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error('Invalid monthly KPI conversionRate');out.conversionRate=Math.round(rate*100)/100}
  out.planMix=cleanCountMap(raw.planMix,'planMix',['Starter','Growth','Pro']);
  out.callOutcomes=cleanCountMap(raw.callOutcomes,'callOutcomes',['resolvedByAi','requestCaptured','messageTaken','transferred','escalated','incomplete','nonCustomer']);
  const coverage=raw.coverage==null?{}:raw.coverage;
  if(!coverage||typeof coverage!=='object'||Array.isArray(coverage))throw new Error('Invalid monthly KPI coverage');
  for(const key of Object.keys(coverage))if(!COVERAGE_FIELDS.includes(key))throw new Error('Unexpected monthly KPI coverage key');
  out.coverage={};for(const key of COVERAGE_FIELDS)out.coverage[key]=coverage[key]===true;
  return out;
}
function monthlyKpiStorageKey(month){if(!validMonth(month))throw new Error('Monthly KPI month is invalid');return 'analytics:monthly:'+month}

async function recordMonthlyKpiSnapshot(kv,raw,{attempts=4}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.eval!=='function')throw new Error('Monthly KPI storage is unavailable');
  const snapshot=sanitizeMonthlyKpiSnapshot(raw),key=monthlyKpiStorageKey(snapshot.month),max=Math.max(1,Math.min(6,Number(attempts)||4));
  for(let attempt=0;attempt<max;attempt++){
    const [current,indexRaw]=await Promise.all([kv.get(key),kv.get(MONTHLY_KPI_INDEX_KEY)]);
    if(current!=null&&(!current||typeof current!=='object'||Array.isArray(current)||current.month!==snapshot.month))throw new Error('Stored monthly KPI snapshot is malformed');
    if(indexRaw!=null&&(!Array.isArray(indexRaw)||indexRaw.some(month=>!validMonth(month))||new Set(indexRaw).size!==indexRaw.length||indexRaw.length>MAX_MONTHLY_KPI_MONTHS))throw new Error('Monthly KPI index is malformed');
    if(current&&Number(current.recordedAt||0)>=snapshot.recordedAt)return {saved:false,snapshot:current,index:(indexRaw||[]).slice(),degraded:false};
    if(current&&COVERAGE_FIELDS.some(key=>current.coverage?.[key]===true&&snapshot.coverage?.[key]!==true))
      return {saved:false,snapshot:current,index:(indexRaw||[]).slice(),degraded:true};
    const index=(indexRaw||[]).includes(snapshot.month)?(indexRaw||[]).slice():[...(indexRaw||[]),snapshot.month].sort();
    if(index.length>MAX_MONTHLY_KPI_MONTHS)throw new Error('Monthly KPI index capacity reached');
    const updates=[{key,before:current,after:snapshot}];
    if(JSON.stringify(index)!==JSON.stringify(indexRaw))updates.push({key:MONTHLY_KPI_INDEX_KEY,before:indexRaw,after:index});
    if(await compareAndSetConfig(kv,updates))return {saved:true,snapshot,index,degraded:false};
  }
  throw new Error('Monthly KPI history changed during save');
}

module.exports={MONTHLY_KPI_INDEX_KEY,MAX_MONTHLY_KPI_MONTHS,COVERAGE_FIELDS,monthKey,sanitizeMonthlyKpiSnapshot,monthlyKpiStorageKey,recordMonthlyKpiSnapshot};
