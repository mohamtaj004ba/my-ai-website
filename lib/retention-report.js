const {scanStaleProspectRetention}=require('./prospect-retention-store');
const {SITE_EVENT_RETENTION_MS,SITE_SESSION_RETENTION_SECONDS}=require('./analytics-retention-policy');
const {MONTHLY_KPI_INDEX_KEY,MAX_MONTHLY_KPI_MONTHS,COVERAGE_FIELDS,monthKey,monthlyKpiStorageKey}=require('./monthly-kpi-rollup');
const {previousMonthWindow,monthlyFinalizationKey}=require('./monthly-kpi-finalization');

const MAX_SITE_EVENTS=5000;
const MAX_SITE_SESSIONS=2000;
const DAY_MS=24*60*60*1000;

function validTimestamp(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0}
function validMonth(value){return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||''))}
function sectionStatus({error=false,warning=false}={}){return error?'error':warning?'warning':'ok'}

async function prospectRetentionSection(kv,now){
  try{
    const plan=await scanStaleProspectRetention(kv,now,{limit:100,consentIds:[]});
    return {
      status:'warning',
      indexed:Number(plan.indexed||0),
      scanned:Number(plan.scanned||0),
      candidateCount:Number(plan.eligible||0),
      previewCount:Array.isArray(plan.planned)?plan.planned.length:0,
      hasMore:plan.hasMore===true,
      consentReviewRequired:true,
      executorReachable:false,
      reason:'consent_source_not_verified'
    };
  }catch(_){
    return {
      status:'error',
      indexed:null,scanned:null,candidateCount:null,previewCount:null,hasMore:null,
      consentReviewRequired:true,executorReachable:false,reason:'prospect_scan_unavailable'
    };
  }
}

async function analyticsRetentionSection(kv,now){
  try{
    const [eventsRaw,sessionIdsRaw]=await Promise.all([
      kv.lrange('site:events',0,MAX_SITE_EVENTS-1),
      kv.lrange('site:session:index',0,MAX_SITE_SESSIONS-1)
    ]);
    if(!Array.isArray(eventsRaw)||!Array.isArray(sessionIdsRaw))throw new Error('analytics indexes unavailable');
    const eventTimes=[],malformedEvents=eventsRaw.filter(event=>{
      const at=validTimestamp(event?.at);
      if(at)eventTimes.push(at);
      return !at;
    }).length,eventBoundary=now-SITE_EVENT_RETENTION_MS;
    const rawSessionIds=sessionIdsRaw.map(id=>String(id||'').trim()),validSessionIds=rawSessionIds.filter(Boolean),
      duplicateSessionIds=Math.max(0,validSessionIds.length-new Set(validSessionIds).size),
      blankSessionIds=rawSessionIds.length-validSessionIds.length,uniqueSessionIds=[...new Set(validSessionIds)];
    let missingSessionRecords=0,malformedSessionRecords=0,expiredSessionRecords=0,oldestSessionAt=0,newestSessionAt=0;
    const sessionBoundary=now-SITE_SESSION_RETENTION_SECONDS*1000;
    for(let offset=0;offset<uniqueSessionIds.length;offset+=100){
      const ids=uniqueSessionIds.slice(offset,offset+100),batch=await Promise.all(ids.map(id=>kv.get('site:session:'+id)));
      for(let i=0;i<batch.length;i++){
        const record=batch[i],id=ids[i];
        if(record==null){missingSessionRecords++;continue}
        const firstAt=validTimestamp(record?.firstAt),lastAt=validTimestamp(record?.lastAt||record?.firstAt);
        if(!record||typeof record!=='object'||Array.isArray(record)||String(record.id||'')!==id||!firstAt||!lastAt){
          malformedSessionRecords++;continue;
        }
        if(lastAt<sessionBoundary)expiredSessionRecords++;
        oldestSessionAt=oldestSessionAt?Math.min(oldestSessionAt,firstAt):firstAt;
        newestSessionAt=Math.max(newestSessionAt,lastAt);
      }
    }
    const oldestEventAt=eventTimes.length?Math.min(...eventTimes):0,newestEventAt=eventTimes.length?Math.max(...eventTimes):0,
      expiredRetainedEvents=eventTimes.filter(at=>at<eventBoundary).length,
      eventCapacityReached=eventsRaw.length>=MAX_SITE_EVENTS,sessionIndexCapacityReached=sessionIdsRaw.length>=MAX_SITE_SESSIONS,
      warning=malformedEvents>0||blankSessionIds>0||duplicateSessionIds>0||missingSessionRecords>0||malformedSessionRecords>0||
        expiredRetainedEvents>0||expiredSessionRecords>0||eventCapacityReached||sessionIndexCapacityReached;
    return {
      status:sectionStatus({warning}),
      rawEventRetentionDays:Math.round(SITE_EVENT_RETENTION_MS/DAY_MS),
      sessionRecordRetentionDays:Math.round(SITE_SESSION_RETENTION_SECONDS/86400),
      retainedEvents:eventsRaw.length,
      malformedEvents,expiredRetainedEvents,
      oldestEventAt:oldestEventAt||null,newestEventAt:newestEventAt||null,
      eventCapacity:MAX_SITE_EVENTS,eventCapacityReached,
      indexedSessions:sessionIdsRaw.length,uniqueSessionIds:uniqueSessionIds.length,
      blankSessionIds,duplicateSessionIds,missingSessionRecords,malformedSessionRecords,expiredSessionRecords,
      oldestSessionAt:oldestSessionAt||null,newestSessionAt:newestSessionAt||null,
      sessionIndexCapacity:MAX_SITE_SESSIONS,sessionIndexCapacityReached,
      compactionScheduled:false
    };
  }catch(_){
    return {
      status:'error',rawEventRetentionDays:Math.round(SITE_EVENT_RETENTION_MS/DAY_MS),
      sessionRecordRetentionDays:Math.round(SITE_SESSION_RETENTION_SECONDS/86400),
      retainedEvents:null,indexedSessions:null,compactionScheduled:false,reason:'analytics_retention_scan_unavailable'
    };
  }
}

async function monthlyRollupSection(kv,now,{maintenanceEnabled=false,cronSecretConfigured=false}={}){
  const currentMonth=monthKey(now),previousMonth=previousMonthWindow(now).month,
    schedulerState=!maintenanceEnabled?'disabled':!cronSecretConfigured?'misconfigured':'active',
    finalizationScheduled=schedulerState==='active';
  try{
    const [indexRaw,current,previousMarker]=await Promise.all([
      kv.get(MONTHLY_KPI_INDEX_KEY),kv.get(monthlyKpiStorageKey(currentMonth)),kv.get(monthlyFinalizationKey(previousMonth))
    ]);
    const index=indexRaw==null?[]:indexRaw;
    if(!Array.isArray(index)||index.length>MAX_MONTHLY_KPI_MONTHS||index.some(month=>!validMonth(month))||new Set(index).size!==index.length)
      throw new Error('monthly rollup index malformed');
    let previousFinalized=false,previousFinalizedAt=null,previousSnapshotRecordedAt=null;
    if(previousMarker!=null){
      if(!previousMarker||typeof previousMarker!=='object'||Array.isArray(previousMarker)||String(previousMarker.month||'')!==previousMonth||
         previousMarker.coverageComplete!==true||!validTimestamp(previousMarker.finalizedAt)||!validTimestamp(previousMarker.snapshotRecordedAt))
        throw new Error('monthly finalization marker malformed');
      previousFinalized=true;previousFinalizedAt=Number(previousMarker.finalizedAt);previousSnapshotRecordedAt=Number(previousMarker.snapshotRecordedAt);
    }
    const shared={previousMonth,previousFinalized,previousFinalizedAt,previousSnapshotRecordedAt,schedulerState,
      maintenanceEnabled:maintenanceEnabled===true,cronSecretConfigured:cronSecretConfigured===true,finalizationScheduled};
    if(current==null){
      return {
        status:'warning',currentMonth,indexedMonths:index.length,indexCapacity:MAX_MONTHLY_KPI_MONTHS,
        indexCapacityReached:index.length>=MAX_MONTHLY_KPI_MONTHS,currentPresent:false,currentRecordedAt:null,
        stale:null,incompleteSources:COVERAGE_FIELDS.slice(),currentIndexed:index.includes(currentMonth),
        ...shared,reason:'current_rollup_missing'
      };
    }
    const recordedAt=validTimestamp(current?.recordedAt),coverage=current?.coverage;
    if(!current||typeof current!=='object'||Array.isArray(current)||String(current.month||'')!==currentMonth||!recordedAt||
       !coverage||typeof coverage!=='object'||Array.isArray(coverage))throw new Error('current rollup malformed');
    const incompleteSources=COVERAGE_FIELDS.filter(key=>coverage[key]!==true),stale=now-recordedAt>DAY_MS,
      indexCapacityReached=index.length>=MAX_MONTHLY_KPI_MONTHS,currentIndexed=index.includes(currentMonth),
      warning=stale||incompleteSources.length>0||indexCapacityReached||!currentIndexed||schedulerState==='misconfigured';
    return {
      status:sectionStatus({warning}),currentMonth,indexedMonths:index.length,indexCapacity:MAX_MONTHLY_KPI_MONTHS,
      indexCapacityReached,currentPresent:true,currentRecordedAt:recordedAt,stale,incompleteSources,currentIndexed,...shared
    };
  }catch(_){
    return {
      status:'error',currentMonth,previousMonth,indexedMonths:null,indexCapacity:MAX_MONTHLY_KPI_MONTHS,currentPresent:null,
      currentRecordedAt:null,incompleteSources:[],previousFinalized:null,previousFinalizedAt:null,previousSnapshotRecordedAt:null,
      schedulerState,maintenanceEnabled:maintenanceEnabled===true,cronSecretConfigured:cronSecretConfigured===true,
      finalizationScheduled,reason:'monthly_rollup_scan_unavailable'
    };
  }
}

async function buildRetentionReport(kv,now=Date.now(),{maintenanceEnabled=false,cronSecretConfigured=false}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.lrange!=='function')throw new Error('Retention report storage is unavailable');
  const generatedAt=validTimestamp(now);if(!generatedAt)throw new Error('Retention report time is invalid');
  const [prospects,analytics,monthlyRollups]=await Promise.all([
    prospectRetentionSection(kv,generatedAt),
    analyticsRetentionSection(kv,generatedAt),
    monthlyRollupSection(kv,generatedAt,{maintenanceEnabled,cronSecretConfigured})
  ]);
  const sections=[prospects,analytics,monthlyRollups],errorSections=sections.filter(section=>section.status==='error').length,
    warningSections=sections.filter(section=>section.status==='warning').length;
  return {
    generatedAt,mode:'dry_run',writeActionsEnabled:false,retentionExecutorReachable:false,
    status:errorSections?'error':warningSections?'warning':'ok',
    errorSections,warningSections,prospects,analytics,monthlyRollups
  };
}

module.exports={MAX_SITE_EVENTS,MAX_SITE_SESSIONS,buildRetentionReport};
