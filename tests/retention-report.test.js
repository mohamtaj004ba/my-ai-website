const test=require('node:test');
const assert=require('node:assert/strict');
const {buildRetentionReport,MAX_SITE_EVENTS,MAX_SITE_SESSIONS}=require('../lib/retention-report');
const {MONTHLY_KPI_INDEX_KEY,COVERAGE_FIELDS,monthlyKpiStorageKey}=require('../lib/monthly-kpi-rollup');
const {monthlyFinalizationKey}=require('../lib/monthly-kpi-finalization');

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function fixture({lists={},records={}}={}){
  let reads=0;
  const data=new Map(Object.entries(records).map(([key,value])=>[key,clone(value)]));
  const listData=new Map(Object.entries(lists).map(([key,value])=>[key,clone(value)]));
  return {
    kv:{
      async get(key){reads++;return data.has(key)?clone(data.get(key)):null},
      async lrange(key,start,end){reads++;const list=listData.get(key);if(!Array.isArray(list))return null;return clone(list.slice(start,end+1))}
    },
    reads:()=>reads
  };
}
function completeCoverage(overrides={}){
  return Object.fromEntries(COVERAGE_FIELDS.map(key=>[key,overrides[key]===undefined?true:overrides[key]]));
}

test('retention report distinguishes verified inactive, active and unknown prospect consent evidence',async()=>{
  const now=Date.UTC(2026,8,29,20),stale=now-370*86400000,recent=now-30*86400000,currentMonth='2026-09',
    notGranted={status:'not_granted',source:'contact_form',noticeVersion:'2026-09-29',recordedAt:stale-1000},
    granted={status:'granted',source:'get_started',noticeVersion:'2026-09-29',recordedAt:stale-1000};
  const f=fixture({
    lists:{
      'site:prospect:index':['p-ready','p-active','p-legacy','p-recent'],
      'site:events':[{type:'page_view',at:now-1000}],
      'site:session:index':['s-1']
    },
    records:{
      'site:prospect:p-ready':{id:'p-ready',email:'ready@example.test',stage:'new',createdAt:stale,updatedAt:stale,marketingEmailConsent:notGranted},
      'site:prospect:p-active':{id:'p-active',email:'active@example.test',stage:'new',createdAt:stale,updatedAt:stale,marketingEmailConsent:granted},
      'site:prospect:p-legacy':{id:'p-legacy',email:'legacy@example.test',stage:'new',createdAt:stale,updatedAt:stale},
      'site:prospect:p-recent':{id:'p-recent',email:'recent@example.test',stage:'inquiry',createdAt:recent,updatedAt:recent,marketingEmailConsent:notGranted},
      'site:session:s-1':{id:'s-1',firstAt:now-60000,lastAt:now-1000,pages:['/'],events:1,activeMs:5000},
      [MONTHLY_KPI_INDEX_KEY]:[currentMonth],
      [monthlyKpiStorageKey(currentMonth)]:{month:currentMonth,recordedAt:now-5000,coverage:completeCoverage()}
    }
  });
  const report=await buildRetentionReport(f.kv,now);
  assert.equal(report.mode,'dry_run');
  assert.equal(report.writeActionsEnabled,false);
  assert.equal(report.retentionExecutorReachable,false);
  assert.equal(report.prospects.candidateCount,1);
  assert.equal(report.prospects.consentEvidenceAvailable,true);
  assert.equal(report.prospects.activeConsentCount,1);
  assert.equal(report.prospects.verifiedInactiveConsentCount,2);
  assert.equal(report.prospects.unknownConsentCount,1);
  assert.equal(report.prospects.consentReviewRequired,true);
  assert.equal(report.prospects.executorReachable,false);
  assert.equal(report.prospects.reason,'legacy_consent_evidence_unknown');
  assert.equal(report.monthlyRollups.status,'ok');
  assert.ok(f.reads()>0);
  const serialized=JSON.stringify(report);
  for(const sensitive of ['ready@example.test','active@example.test','legacy@example.test','p-ready','p-active','p-legacy'])
    assert.equal(serialized.includes(sensitive),false);
});

test('analytics retention report surfaces expired raw history and stale session-index entries without mutating them',async()=>{
  const now=Date.UTC(2026,8,29),old=now-181*86400000,currentMonth='2026-09';
  const f=fixture({
    lists:{
      'site:prospect:index':[],
      'site:events':[{type:'page_view',at:old},{type:'page_view',at:now-1000}],
      'site:session:index':['s-expired','s-missing','s-expired']
    },
    records:{
      'site:session:s-expired':{id:'s-expired',firstAt:old-1000,lastAt:old,pages:['/'],events:1,activeMs:1},
      [MONTHLY_KPI_INDEX_KEY]:[currentMonth],
      [monthlyKpiStorageKey(currentMonth)]:{month:currentMonth,recordedAt:now-1000,coverage:completeCoverage()}
    }
  });
  const report=await buildRetentionReport(f.kv,now),a=report.analytics;
  assert.equal(a.status,'warning');
  assert.equal(a.expiredRetainedEvents,1);
  assert.equal(a.expiredSessionRecords,1);
  assert.equal(a.missingSessionRecords,1);
  assert.equal(a.duplicateSessionIds,1);
  assert.equal(a.compactionScheduled,false);
  assert.equal(a.eventCapacity,MAX_SITE_EVENTS);
  assert.equal(a.sessionIndexCapacity,MAX_SITE_SESSIONS);
  assert.equal(a.rawEventRetentionDays,180);
  assert.equal(a.sessionRecordRetentionDays,180);
});

test('monthly rollup section reports incomplete coverage instead of treating unknown metrics as complete',async()=>{
  const now=Date.UTC(2026,8,29),month='2026-09',coverage=completeCoverage({paymentFailures:false});
  const f=fixture({
    lists:{'site:prospect:index':[],'site:events':[],'site:session:index':[]},
    records:{
      [MONTHLY_KPI_INDEX_KEY]:[month],
      [monthlyKpiStorageKey(month)]:{month,recordedAt:now-1000,coverage}
    }
  });
  const report=await buildRetentionReport(f.kv,now);
  assert.equal(report.monthlyRollups.status,'warning');
  assert.deepEqual(report.monthlyRollups.incompleteSources,['paymentFailures']);
  assert.equal(report.monthlyRollups.currentPresent,true);
  assert.equal(report.monthlyRollups.finalizationScheduled,false);
});

test('a malformed source degrades only its section and preserves the rest of the dry-run',async()=>{
  const now=Date.UTC(2026,8,29),month='2026-09';
  const f=fixture({
    lists:{
      'site:prospect:index':['dup','dup'],
      'site:events':[],
      'site:session:index':[]
    },
    records:{
      [MONTHLY_KPI_INDEX_KEY]:[month],
      [monthlyKpiStorageKey(month)]:{month,recordedAt:now-1000,coverage:completeCoverage()}
    }
  });
  const report=await buildRetentionReport(f.kv,now);
  assert.equal(report.status,'error');
  assert.equal(report.prospects.status,'error');
  assert.equal(report.prospects.reason,'prospect_scan_unavailable');
  assert.equal(report.analytics.status,'ok');
  assert.equal(report.monthlyRollups.status,'ok');
  assert.equal(report.writeActionsEnabled,false);
});

test('missing current monthly rollup remains a warning and never fabricates a complete month',async()=>{
  const now=Date.UTC(2026,8,29);
  const f=fixture({
    lists:{'site:prospect:index':[],'site:events':[],'site:session:index':[]},
    records:{[MONTHLY_KPI_INDEX_KEY]:[]}
  });
  const report=await buildRetentionReport(f.kv,now);
  assert.equal(report.monthlyRollups.status,'warning');
  assert.equal(report.monthlyRollups.currentPresent,false);
  assert.equal(report.monthlyRollups.reason,'current_rollup_missing');
  assert.deepEqual(report.monthlyRollups.incompleteSources,COVERAGE_FIELDS);
});


test('monthly retention status distinguishes active finalization cadence from disabled and misconfigured states',async()=>{
  const now=Date.UTC(2026,8,29),month='2026-09',previous='2026-08',recordedAt=now-1000;
  const f=fixture({
    lists:{'site:prospect:index':[],'site:events':[],'site:session:index':[]},
    records:{
      [MONTHLY_KPI_INDEX_KEY]:[previous,month],
      [monthlyKpiStorageKey(month)]:{month,recordedAt,coverage:completeCoverage()},
      [monthlyFinalizationKey(previous)]:{month:previous,finalizedAt:Date.UTC(2026,8,1,5),snapshotRecordedAt:Date.UTC(2026,7,31,5,17),coverageComplete:true}
    }
  });
  const active=await buildRetentionReport(f.kv,now,{maintenanceEnabled:true,cronSecretConfigured:true});
  assert.equal(active.monthlyRollups.schedulerState,'active');
  assert.equal(active.monthlyRollups.finalizationScheduled,true);
  assert.equal(active.monthlyRollups.previousMonth,previous);
  assert.equal(active.monthlyRollups.previousFinalized,true);
  assert.equal(active.monthlyRollups.previousSnapshotRecordedAt,Date.UTC(2026,7,31,5,17));

  const misconfigured=await buildRetentionReport(f.kv,now,{maintenanceEnabled:true,cronSecretConfigured:false});
  assert.equal(misconfigured.monthlyRollups.schedulerState,'misconfigured');
  assert.equal(misconfigured.monthlyRollups.finalizationScheduled,false);
  assert.equal(misconfigured.monthlyRollups.status,'warning');

  const disabled=await buildRetentionReport(f.kv,now,{maintenanceEnabled:false,cronSecretConfigured:true});
  assert.equal(disabled.monthlyRollups.schedulerState,'disabled');
  assert.equal(disabled.monthlyRollups.finalizationScheduled,false);
});
