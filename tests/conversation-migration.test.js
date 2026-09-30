const test=require('node:test');
const assert=require('node:assert/strict');
const {indexKey,indexConversation}=require('../lib/conversation-store');
const {workspaceStatus,scanConversationMigrationWorkspace,scanConversationMigrationBatch,MAX_BATCH}=require('../lib/conversation-migration');

function fixture({workspaceIds=[],records={}}={}){
  const data=new Map([['workspace:index',workspaceIds],...Object.entries(records)]);
  return {data,kv:{async get(key){return data.has(key)?JSON.parse(JSON.stringify(data.get(key))):null}}};
}
function conversations(){return [
  {id:'a',name:'Ada',phone:'5095550101',status:'Active',createdAt:10,messages:[{text:'hello',at:11}]},
  {id:'b',name:'Ben',phone:'5095550102',status:'Closed',createdAt:20,messages:[{text:'done',at:21}]}
]}
function normalized(items,updatedAt=100){return {version:2,updatedAt,conversations:items.map(indexConversation)}}

test('workspace dry-run classifies aligned, legacy-only and missing rollback sources without record mutation',()=>{
  const items=conversations();
  assert.equal(workspaceStatus(items,normalized(items)).status,'aligned');
  assert.equal(workspaceStatus(items,null).status,'legacy_only');
  assert.equal(workspaceStatus(null,normalized(items)).status,'rollback_source_missing');
  assert.equal(workspaceStatus(null,null).status,'empty_uninitialized');
});

test('summary drift is detected even when conversation ids and counts still match',()=>{
  const items=conversations(),index=normalized(items);
  index.conversations[0].status='Closed';
  const result=workspaceStatus(items,index);
  assert.equal(result.status,'drifted');
  assert.equal(result.legacyCount,2);
  assert.equal(result.normalizedCount,2);
});

test('paged migration report returns counts only and keeps every write path unreachable',async()=>{
  const items=conversations(),f=fixture({
    workspaceIds:['ws-aligned','ws-legacy','ws-missing','ws-empty'],
    records:{
      'conversations:ws-aligned':items,[indexKey('ws-aligned')]:normalized(items),
      'conversations:ws-legacy':items,
      [indexKey('ws-missing')]:normalized(items),
      'conversations:ws-empty':[]
    }
  });
  const report=await scanConversationMigrationBatch(f.kv,{limit:10});
  assert.equal(report.mode,'dry_run');
  assert.equal(report.writeActionsEnabled,false);
  assert.equal(report.migrationExecutorReachable,false);
  assert.equal(report.legacyPreserved,true);
  assert.equal(report.detailFidelityChecked,false);
  assert.equal(report.complete,true);
  assert.equal(report.scanned,4);
  assert.equal(report.totalWorkspaces,4);
  assert.deepEqual(report.counts,{aligned:1,legacyOnly:2,drifted:0,rollbackSourceMissing:1,emptyUninitialized:0,malformed:0});
  assert.equal(report.migrationCandidates,2);
  assert.equal(report.blockingWorkspaces,1);
  assert.equal(report.status,'error');
  const text=JSON.stringify(report);
  assert.equal(text.includes('ws-aligned'),false);
  assert.equal(text.includes('Ada'),false);
  assert.equal(text.includes('5095550101'),false);
});

test('pagination cursor is bound to the workspace index snapshot',async()=>{
  const items=conversations(),f=fixture({
    workspaceIds:['one','two','three'],
    records:{'conversations:one':items,'conversations:two':items,'conversations:three':items}
  });
  const first=await scanConversationMigrationBatch(f.kv,{limit:2});
  assert.equal(first.scanned,2);assert.ok(first.nextCursor);assert.equal(first.complete,false);
  const second=await scanConversationMigrationBatch(f.kv,{limit:2,cursor:first.nextCursor});
  assert.equal(second.scanned,1);assert.equal(second.complete,true);
  f.data.set('workspace:index',['new','one','two','three']);
  await assert.rejects(()=>scanConversationMigrationBatch(f.kv,{limit:2,cursor:first.nextCursor}),/Invalid or expired/);
});

test('malformed workspace records are counted as blockers instead of leaking partial details',async()=>{
  const f=fixture({workspaceIds:['bad'],records:{'conversations:bad':{broken:true}}});
  const report=await scanConversationMigrationBatch(f.kv);
  assert.equal(report.counts.malformed,1);
  assert.equal(report.blockingWorkspaces,1);
  assert.equal(report.status,'error');
});

test('batch size is capped and duplicate workspace ids fail closed',async()=>{
  const ids=Array.from({length:MAX_BATCH+5},(_,i)=>'ws-'+i),f=fixture({workspaceIds:ids});
  const report=await scanConversationMigrationBatch(f.kv,{limit:MAX_BATCH+999});
  assert.equal(report.scanned,MAX_BATCH);
  const duplicate=fixture({workspaceIds:['same','same']});
  await assert.rejects(()=>scanConversationMigrationBatch(duplicate.kv),/malformed/);
});


test('focused workspace dry run proves one seeded workspace is aligned without exposing its id',async()=>{
  const items=conversations(),f=fixture({
    workspaceIds:['target','other'],
    records:{
      'conversations:target':items,[indexKey('target')]:normalized(items),
      'conversations:other':items
    }
  });
  const report=await scanConversationMigrationWorkspace(f.kv,'target');
  assert.equal(report.mode,'dry_run');
  assert.equal(report.writeActionsEnabled,false);
  assert.equal(report.migrationExecutorReachable,false);
  assert.equal(report.legacyPreserved,true);
  assert.equal(report.workspaceState,'aligned');
  assert.equal(report.aligned,true);
  assert.equal(report.blocking,false);
  assert.equal(report.migrationCandidate,false);
  assert.equal(report.legacyConversations,2);
  assert.equal(report.normalizedConversations,2);
  assert.equal(JSON.stringify(report).includes('target'),false);
  await assert.rejects(()=>scanConversationMigrationWorkspace(f.kv,'missing'),err=>err&&err.code==='WORKSPACE_NOT_FOUND');
});
