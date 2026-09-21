const {kv}=require('@vercel/kv');

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  if(!host.endsWith('.vercel.app')||process.env.VERCEL_ENV!=='preview')return res.status(404).json({error:'Not found'});
  const lastHealthCheck=await kv.get('health:last_check');
  return res.status(200).json({environment:'preview',lastHealthCheck:Number(lastHealthCheck||0)});
};
