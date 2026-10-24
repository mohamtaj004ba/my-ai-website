const WORKSPACE_RETENTION_MS=7*365*24*60*60*1000;
const OPERATIONAL_RETENTION_MS=2*365*24*60*60*1000;
const PURGE_PHASES=['prepared','retained','detached','support','feedback','growth','conversations','audit_retained','content'];

function purgeJournalKey(id){return 'purge:workspace:'+String(id||'')}
function purgeCompleteKey(id){return 'purge:complete:'+String(id||'')}

function validIdDirectory(raw,limit=2000){
  return raw==null||(Array.isArray(raw)&&raw.length<=limit&&raw.every(id=>typeof id==='string'&&!!id.trim())&&new Set(raw).size===raw.length);
}

function validPurgeJournal(value,id=''){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!PURGE_PHASES.includes(value.phase))return false;
  if(id&&String(value.workspaceId)!==String(id))return false;
  if(!value.source||typeof value.source!=='object'||Array.isArray(value.source))return false;
  return Number.isFinite(Number(value.startedAt))&&Number(value.startedAt)>0&&Number.isFinite(Number(value.retainedUntil))&&Number(value.retainedUntil)>Number(value.startedAt);
}

function nextPurgeJournal(journal,phase,extra={},now=Date.now()){
  if(!validPurgeJournal(journal,journal&&journal.workspaceId)||!PURGE_PHASES.includes(phase))throw new Error('Invalid purge journal transition');
  const current=PURGE_PHASES.indexOf(journal.phase),next=PURGE_PHASES.indexOf(phase);
  if(next<current||next>current+1)throw new Error('Invalid purge phase transition');
  return {...journal,...extra,phase,updatedAt:Math.max(Number(now)||Date.now(),Number(journal.updatedAt||journal.startedAt||0)+1)};
}

function retentionTtlSeconds(until,now=Date.now()){
  const remaining=Number(until)-Number(now);
  if(!Number.isFinite(remaining)||remaining<=0)throw new Error('Retention window has ended');
  return Math.max(60,Math.ceil(remaining/1000));
}

module.exports={WORKSPACE_RETENTION_MS,OPERATIONAL_RETENTION_MS,PURGE_PHASES,purgeJournalKey,purgeCompleteKey,validIdDirectory,validPurgeJournal,nextPurgeJournal,retentionTtlSeconds};
