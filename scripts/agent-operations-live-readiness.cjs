'use strict';
// Offline prerequisite only. Never initializes tasks, approvals or paid execution.
const {spawnSync}=require('node:child_process'),path=require('node:path'),root=path.resolve(__dirname,'..');
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--base'||!/^[a-f0-9]{40}$/.test(args[1])){console.error('Explicit verified --base <40-character SHA> required');process.exit(1);}
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^OPENAI_|^CALLERCORE_|^VERCEL_/i.test(k)));
for(const [file,extra] of [['engineering-quality-preflight.cjs',args],['agent-operations-contract-preflight.cjs',[]]]){
 const r=spawnSync(process.execPath,[path.join(__dirname,file),...extra],{cwd:root,env,stdio:'inherit',windowsHide:true});
 if(r.status!==0)process.exit(r.status||1);
}
console.log(JSON.stringify({offlinePrerequisites:'passed',nodeControllerVersion:require('../lib/agent-operations-node-controller').VERSION,requiresAuthenticatedOwnerSupervisor:true,legacyLocalControllerRetired:true,modelRequests:0,paidAuthorization:false,requiresTrackedOrganizationalLaunch:true,actualHostedRehearsal:'required-not-inferred-from-offline-tests',requires:['capture-browser-startup-fonts-oidc-and-evidence-directory','trusted-independent-assessment','pre-initialization-bound-revocation','authenticated-independent-review','exact-source-hosted-checks','current-budget-and-holds','explicit-owner-approval','disabled-rollback-path'],liveVerified:false}));
