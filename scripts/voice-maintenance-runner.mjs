import {pathToFileURL} from 'node:url';
export const PREVIEW_ORIGIN='https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app';
class MaintenanceError extends Error{}
export async function runMaintenance({env=process.env,fetchImpl=fetch,timeoutMs=60000}={}){
  // No arbitrary target, redirect, caller-selected workspace or production
  // credential. Credential installation in a scheduler remains an owner step.
  if(env.CALLERCORE_VOICE_MAINTENANCE_URL!==PREVIEW_ORIGIN+'/api/voice-maintenance')throw new Error('Use the approved feature-branch Preview maintenance URL');
  const secret=env.CALLERCORE_VOICE_WEBHOOK_SECRET;
  if(typeof secret!=='string'||secret.length<32||/[\r\n]/.test(secret))throw new Error('Restricted Preview callback credential is required');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    const response=await fetchImpl(env.CALLERCORE_VOICE_MAINTENANCE_URL,{method:'POST',redirect:'error',signal:abort.signal,headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},body:'{}'});
    if(!response.ok)throw new MaintenanceError('Maintenance could not be confirmed (HTTP '+response.status+'); pending records are preserved');
    let result;try{result=await response.json()}catch{throw new MaintenanceError('Maintenance response could not be verified')}
    if(!result||!['workspaces','checked','failed'].every(k=>Number.isSafeInteger(result[k])&&result[k]>=0)||result.workspaces>2||!(result.pending===null||Number.isSafeInteger(result.pending)&&result.pending>=0)||typeof result.busy!=='boolean')throw new MaintenanceError('Maintenance response could not be verified');
    const safe={workspaces:result.workspaces,checked:result.checked,failed:result.failed,pending:result.pending,busy:result.busy};
    if(!safe.workspaces)throw new MaintenanceError('Maintenance found no verified isolated resources; check the saved bindings');
    if(safe.failed||safe.pending===null)throw new MaintenanceError('Some call details could not be checked; pending records are preserved');
    return safe;
  }catch(error){
    if(abort.signal.aborted)throw new Error('Maintenance timed out; its result is uncertain. No automatic retry was started');
    // Transport/provider bodies may contain credentials. Only our known errors
    // leave this process; a scheduler never prints the fetch exception.
    if(error instanceof MaintenanceError)throw error;
    throw new Error('Maintenance connection could not be confirmed; no automatic retry was started');
  }finally{clearTimeout(timer)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await runMaintenance()))}catch(error){console.error(error.message);process.exitCode=1}
}
