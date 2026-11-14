const crypto=require('crypto');
const {kv}=require('../lib/kv');
const {refreshMonthlyKpiSnapshot}=require('../lib/monthly-kpi-producer');
const {finalizePreviousMonthlyKpi}=require('../lib/monthly-kpi-finalization');
const {safeError}=require('../lib/safe-log');

function secureEqual(left,right){
  const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));
  if(a.length!==b.length||!a.length)return false;
  try{return crypto.timingSafeEqual(a,b)}catch(_){return false}
}
function cronAuthorized(req){
  const secret=String(process.env.CRON_SECRET||'');
  const auth=String(req.headers?.authorization||'');
  return !!secret&&secureEqual(auth,'Bearer '+secret);
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  if(process.env.CALLERCORE_MAINTENANCE_ENABLED!=='true')
    return res.status(200).json({maintenance:{enabled:false,changed:false}});
  if(!process.env.CRON_SECRET)return res.status(503).json({error:'Maintenance scheduler is not configured'});
  if(!cronAuthorized(req))return res.status(403).json({error:'Invalid maintenance authorization'});
  const now=Date.now();
  try{
    const current=await refreshMonthlyKpiSnapshot(kv,{now,minIntervalMs:0});
    const previous=await finalizePreviousMonthlyKpi(kv,{now});
    return res.status(200).json({maintenance:{
      enabled:true,month:String(current.snapshot?.month||''),rollupSaved:current.saved===true,rollupDegraded:current.degraded===true,
      previousMonth:String(previous.month||''),previousFinalized:previous.finalized===true,previousAlreadyFinalized:previous.alreadyFinalized===true,
      previousReason:String(previous.reason||'').slice(0,80)
    }});
  }catch(err){
    console.error('analytics maintenance failed',safeError(err));
    return res.status(503).json({error:'Analytics maintenance could not be confirmed. Existing monthly history was left unchanged.'});
  }
};
