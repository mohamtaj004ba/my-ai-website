'use strict';
// Policy foundation only. No production browser service or session is configured.
const PATHS=Object.freeze(['/','/industries/legal']);
function authorize({environment,branch,origin,sourceCommit},target){if(environment!=='preview'||branch!=='feature/callercore-dashboards'||!/^https:\/\/my-ai-website-[a-z0-9]+-mohamtaj004bas-projects\.vercel\.app$/.test(origin||'')||!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw Error('ENG_BROWSER_SCOPE');const u=new URL(target);if(u.origin!==origin||u.username||u.password||u.search||u.hash||!PATHS.includes(u.pathname))throw Error('ENG_BROWSER_URL_DENIED');return{origin,sourceCommit,path:u.pathname,viewport:{width:1440,height:1000},forms:false,downloads:false,serviceWorkers:false,externalOrigins:false,cookiesInEvidence:false,executor:'unavailable-deployed-browser-service-and-scoped-protection-identity-required'};}
module.exports={authorize,PATHS};
