const test=require('node:test');
const assert=require('node:assert/strict');
const {
  WORKSPACE_RETENTION_MS,OPERATIONAL_RETENTION_MS,PURGE_PHASES,
  purgeJournalKey,purgeCompleteKey,validIdDirectory,validPurgeJournal,nextPurgeJournal,retentionTtlSeconds
}=require('../lib/purge-state');

test('purge state exposes fixed retention windows and ordered phases',()=>{
  assert.equal(WORKSPACE_RETENTION_MS,7*365*24*60*60*1000);
  assert.equal(OPERATIONAL_RETENTION_MS,2*365*24*60*60*1000);
  assert.deepEqual(PURGE_PHASES,['prepared','retained','detached','support','feedback','conversations','audit_retained','content']);
  assert.equal(purgeJournalKey('x'),'purge:workspace:x');assert.equal(purgeCompleteKey('x'),'purge:complete:x');
});

test('purge journal only moves forward one phase or repeats the current phase',()=>{
  const base={version:1,workspaceId:'w',phase:'prepared',startedAt:10,updatedAt:10,retainedUntil:1000,source:{}};
  assert.equal(nextPurgeJournal(base,'prepared',{},11).phase,'prepared');
  const retained=nextPurgeJournal(base,'retained',{x:1},12);assert.equal(retained.phase,'retained');assert.equal(retained.x,1);
  assert.throws(()=>nextPurgeJournal(base,'detached'),/Invalid purge phase transition/);
  assert.throws(()=>nextPurgeJournal(retained,'prepared'),/Invalid purge phase transition/);
});

test('directory and journal validation fail closed on malformed data',()=>{
  assert.equal(validIdDirectory(null),true);assert.equal(validIdDirectory(['a','b']),true);
  assert.equal(validIdDirectory(['a','a']),false);assert.equal(validIdDirectory({a:1}),false);assert.equal(validIdDirectory(Array.from({length:3},(_,i)=>String(i)),2),false);
  const good={version:1,workspaceId:'w',phase:'prepared',startedAt:10,updatedAt:10,retainedUntil:1000,source:{}};
  assert.equal(validPurgeJournal(good,'w'),true);assert.equal(validPurgeJournal({...good,phase:'bad'},'w'),false);assert.equal(validPurgeJournal(good,'other'),false);
});

test('retention TTL is fixed to the original deadline rather than extended on retries',()=>{
  assert.equal(retentionTtlSeconds(101000,1000),100);
  assert.equal(retentionTtlSeconds(61500,1000),61);
  assert.throws(()=>retentionTtlSeconds(1000,1000),/ended/);
});
