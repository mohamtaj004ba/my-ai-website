// Normal browser navigation handles the existing Vercel cookie bootstrap.
// Existing origin-scoped context routing strips protection headers off-origin.
// Never inspect or log a private response body or redirect URL.
export const PRIVATE_SOURCE_PATHS=Object.freeze(['/node_modules/.cache/callercore/repository-source.json.gz','/lib/agent-operations-repository-source.js','/scripts/prepare-repository-source.cjs','/CALLERCORE_PROJECT_STATE.md']);
export async function verifyPrivateRepositoryAssets(page,baseURL){
 const base=new URL(baseURL),results=[];
 for(const [index,path]of ['/',...PRIVATE_SOURCE_PATHS].entries()){
  let response;try{response=await page.goto(new URL(path,base).href,{waitUntil:'domcontentloaded',timeout:30000});}catch{throw Error('PRIVATE_SOURCE_NAVIGATION_UNCONFIRMED: probe='+index);}
  let actual;try{actual=new URL(response?.url());}catch{throw Error('PRIVATE_SOURCE_RESPONSE_UNCONFIRMED: probe='+index);}
  const status=response.status(),expected=index===0?200:404;
  if(actual.origin!==base.origin||actual.pathname!==path||actual.search||status!==expected)throw Error('PRIVATE_SOURCE_BOUNDARY_UNCONFIRMED: probe='+index+' status='+(Number.isSafeInteger(status)?status:'unknown')+' origin='+(actual.origin===base.origin?'same':'foreign'));
  results.push({path,status});
 }
 return{positiveControl:results[0],privatePaths:results.slice(1),responseBodiesRead:false};
}
