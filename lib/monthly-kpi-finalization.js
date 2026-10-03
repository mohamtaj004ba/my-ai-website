const {compareAndSetConfig}=require('./config-transaction');
const {COVERAGE_FIELDS,monthlyKpiStorageKey}=require('./monthly-kpi-rollup');

const MONTH_END_FRESHNESS_MS=24*60*60*1000;

function monthLabel(start){
  const d=new Date(start);
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
}
function previousMonthWindow(now=Date.now()){
  const d=new Date(Number(now));if(!Number.isFinite(d.getTime()))throw new Error('Monthly finalization time is invalid');
  const end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1),start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1);
  return {month:monthLabel(start),start,end};
}
function monthlyFinalizationKey(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||'')))throw new Error('Monthly finalization month is invalid');
  return 'analytics:monthly:finalized:'+month;
}
function validateMarker(value,month){
  if(!value||typeof value!=='object'||Array.isArray(value)||String(value.month||'')!==month||
     !Number.isFinite(Number(value.finalizedAt))||Number(value.finalizedAt)<=0||
     !Number.isFinite(Number(value.snapshotRecordedAt))||Number(value.snapshotRecordedAt)<=0||
     value.coverageComplete!==true)throw new Error('Monthly finalization marker is malformed');
  return {month,finalizedAt:Number(value.finalizedAt),snapshotRecordedAt:Number(value.snapshotRecordedAt),coverageComplete:true};
}
async function finalizePreviousMonthlyKpi(kv,{now=Date.now(),freshnessMs=MONTH_END_FRESHNESS_MS}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.eval!=='function')throw new Error('Monthly finalization storage is unavailable');
  const finalizedAt=Number(now),freshness=Math.max(60*60*1000,Math.min(7*24*60*60*1000,Number(freshnessMs)||MONTH_END_FRESHNESS_MS)),
    {month,start,end}=previousMonthWindow(finalizedAt),key=monthlyFinalizationKey(month);
  const [existing,snapshot]=await Promise.all([kv.get(key),kv.get(monthlyKpiStorageKey(month))]);
  if(existing!=null)return {finalized:false,alreadyFinalized:true,marker:validateMarker(existing,month),month,reason:''};
  if(snapshot==null)return {finalized:false,alreadyFinalized:false,marker:null,month,reason:'snapshot_missing'};
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||String(snapshot.month||'')!==month)throw new Error('Monthly KPI snapshot is malformed for finalization');
  const recordedAt=Number(snapshot.recordedAt);
  if(!Number.isFinite(recordedAt)||recordedAt<start||recordedAt>=end)throw new Error('Monthly KPI snapshot timestamp is outside its month');
  const incomplete=COVERAGE_FIELDS.filter(field=>snapshot.coverage?.[field]!==true);
  if(incomplete.length)return {finalized:false,alreadyFinalized:false,marker:null,month,reason:'coverage_incomplete',incompleteSources:incomplete};
  if(end-recordedAt>freshness)return {finalized:false,alreadyFinalized:false,marker:null,month,reason:'snapshot_not_near_month_end',snapshotRecordedAt:recordedAt};
  const marker={month,finalizedAt,snapshotRecordedAt:recordedAt,coverageComplete:true};
  if(!await compareAndSetConfig(kv,[{key,before:null,after:marker}])){
    const confirmed=await kv.get(key);
    if(confirmed!=null)return {finalized:false,alreadyFinalized:true,marker:validateMarker(confirmed,month),month,reason:''};
    return {finalized:false,alreadyFinalized:false,marker:null,month,reason:'concurrent_change'};
  }
  return {finalized:true,alreadyFinalized:false,marker,month,reason:''};
}

module.exports={MONTH_END_FRESHNESS_MS,previousMonthWindow,monthlyFinalizationKey,finalizePreviousMonthlyKpi};
