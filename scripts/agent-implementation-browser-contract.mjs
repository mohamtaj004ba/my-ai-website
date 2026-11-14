// Metadata advertises a reviewed recipe; it must never advertise a grant.
export function verifyImplementationTaskMetadata(tasks){
  const profiles=new Map([['call-row-visible-time-v1','call-row-visible-time-source-tests-v1'],['client-phone-search-v1','client-phone-search-tests-v1']]);
  if(!Array.isArray(tasks)||!tasks.length||new Set(tasks.map(t=>t?.id)).size!==tasks.length)throw new Error('Bounded implementation metadata is malformed');
  for(const task of tasks){
    if(typeof task?.id!=='string'||!task.id||task.paidExecution!==false||task.publicationAuthorized!==false||task.availability?.executionAuthorized!==false||(task.executionAuthorized!==undefined&&task.executionAuthorized!==false))throw new Error('Bounded implementation metadata grants execution or publication');
    if(task.testProfile!==null&&(!profiles.has(task.id)||typeof task.testProfile!=='string'||profiles.get(task.id)!==task.testProfile))throw new Error('Bounded implementation metadata advertises an unreviewed test profile');
  }
  for(const [id,profile]of profiles)if(!tasks.some(t=>t.id===id&&t.testProfile===profile))throw new Error('Qualified task-specific test metadata is missing');
  return{qualifiedProfiles:[...profiles].map(([taskId,profile])=>({taskId,profile})),executionAuthorized:false};
}
