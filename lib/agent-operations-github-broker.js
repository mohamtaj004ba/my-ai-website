'use strict';
// Server-only App authentication. No caller-selected identity, permission map, or secret output.
const {createPrivateKey,sign}=require('node:crypto');
const app=require('./agent-operations-github-app');
const ID=Object.freeze({appId:5321141,clientId:'Iv23limGoBhX5S9ezVNq',installationId:171494892,repositoryId:1284219633,repository:app.REPOSITORY});
const check=(x,c)=>{if(!x)throw Error(c);};
async function json(response){check(response?.ok,'GH_BROKER_PROVIDER_DENIED');check(Number(response.headers.get('content-length')||0)<=100000,'GH_BROKER_RESPONSE_BOUNDS');let n=0;const parts=[];for await(const p of response.body){n+=p.length;check(n<=100000,'GH_BROKER_RESPONSE_BOUNDS');parts.push(p);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
function create({environment,branch,readKey,authorize,fetchImpl=fetch,clock=Date.now}={}){
 check(environment==='preview'&&branch==='feature/callercore-dashboards'&&typeof readKey==='function'&&typeof authorize==='function','GH_BROKER_CONFIGURATION');
 return async function mint(request,{signal}={}){
  let jwt,key;
  const guard=async()=>{check(!signal?.aborted,'GH_BROKER_CANCELLED');check(await authorize()===true,'GH_BROKER_AUTHORITY_DENIED');check(!signal?.aborted,'GH_BROKER_CANCELLED');};
  try{
   check(request&&JSON.stringify(request)===JSON.stringify({installationId:ID.installationId,repository_ids:[ID.repositoryId],permissions:{...app.PERMISSIONS},credentialReference:'vercel:github:preview'}),'GH_BROKER_SCOPE');
   await guard();const pem=readKey();check(typeof pem==='string'&&pem.length<20000,'GH_BROKER_KEY_UNAVAILABLE');key=createPrivateKey(pem);check(key.asymmetricKeyType==='rsa'&&key.asymmetricKeyDetails?.modulusLength>=2048,'GH_BROKER_KEY_INVALID');
   const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const body=encode({alg:'RS256',typ:'JWT'})+'.'+encode(app.jwtClaims(ID.clientId,clock()));jwt=body+'.'+sign('RSA-SHA256',Buffer.from(body),key).toString('base64url');key=undefined;
   async function call(path,method,body){await guard();return fetchImpl('https://api.github.com'+path,{method,redirect:'error',signal,headers:{Accept:'application/vnd.github+json','User-Agent':'CallerCore-scoped-GitHub-App','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+jwt,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
   const installation=await json(await call('/app/installations/'+ID.installationId,'GET'));
   check(installation.id===ID.installationId&&installation.app_id===ID.appId&&installation.account?.login==='mohamtaj004ba'&&installation.repository_selection==='selected'&&!installation.suspended_at,'GH_BROKER_INSTALLATION_DENIED');
   const raw=await json(await call('/app/installations/'+ID.installationId+'/access_tokens','POST',{repository_ids:[ID.repositoryId],permissions:{...app.PERMISSIONS}}));
   await guard();const expiresAt=Date.parse(raw.expires_at);check(typeof raw.token==='string'&&/^ghs_[A-Za-z0-9_.-]{8,8192}$/.test(raw.token)&&Number.isSafeInteger(expiresAt)&&expiresAt>clock()+10000&&expiresAt<=clock()+3600000,'GH_BROKER_TOKEN_INVALID');
   check(raw.permissions&&Object.keys(raw.permissions).length===3&&Object.keys(app.PERMISSIONS).every(k=>raw.permissions[k]==='read'),'GH_BROKER_SCOPE');
   check(Array.isArray(raw.repositories)&&raw.repositories.length===1&&raw.repositories[0].id===ID.repositoryId&&raw.repositories[0].full_name===ID.repository,'GH_BROKER_SCOPE');
   return{token:raw.token,installationId:installation.id,repositoryId:raw.repositories[0].id,repository:raw.repositories[0].full_name,expiresAt,permissions:{...raw.permissions}};
  }catch{throw Error(signal?.aborted?'GH_BROKER_CANCELLED':'GH_BROKER_AUTHENTICATION_UNCONFIRMED');}finally{jwt=undefined;key=undefined;}
 };
}
function config(){return{environment:'preview',repository:ID.repository,repositoryId:ID.repositoryId,installationId:ID.installationId,credentialReference:'vercel:github:preview'};}
module.exports={ID,create,config};
