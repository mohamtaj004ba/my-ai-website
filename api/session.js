const {requireSession}=require('../lib/auth');
const {kv}=require('@vercel/kv');
const {entitlementsFor}=require('../lib/plans');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const session=await requireSession(req,res);if(!session)return;
  const ws=await kv.get('workspace:'+session.workspaceId);
  if(!ws)return res.status(404).json({error:'Workspace not found'});
  const ent=entitlementsFor(ws.plan);
  return res.status(200).json({user:{email:session.email,role:session.role},workspace:{id:ws.id,name:ws.name,plan:ent.plan,status:ws.status||'active',subscriptionStatus:ws.subscriptionStatus||'active',usage:ws.usage||{minutes:0},stripe:{customerLinked:!!ws.stripeCustomerId,subscriptionLinked:!!ws.stripeSubscriptionId},entitlements:ent}});
};