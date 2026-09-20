const {requireSession}=require('../lib/auth');
const {kv}=require('@vercel/kv');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const session=await requireSession(req,res);if(!session)return;
  if(req.method==='GET'){
    const ws=await kv.get('workspace:'+session.workspaceId);
    if(!ws)return res.status(404).json({error:'Workspace not found'});
    return res.status(200).json({workspace:{id:ws.id,name:ws.name,plan:ws.plan,status:ws.status,ownerEmail:ws.ownerEmail,usage:ws.usage||{minutes:0},createdAt:ws.createdAt}});
  }
  return res.status(405).json({error:'Method not allowed'});
};