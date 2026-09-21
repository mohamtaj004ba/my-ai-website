const crypto=require('crypto');
const {kv}=require('@vercel/kv');

function identifierHash(value){
  return crypto.createHash('sha256').update(String(value||'unknown')).digest('hex').slice(0,32);
}
function requestIp(req){
  const fwd=req?.headers?.['x-forwarded-for'];
  return String(fwd?fwd.split(',')[0].trim():(req?.socket?.remoteAddress||'unknown'));
}
async function rateLimit({scope,identifier,limit,windowSeconds}){
  const safeScope=String(scope||'generic').replace(/[^a-z0-9:_-]/gi,'').slice(0,60)||'generic';
  const max=Math.max(1,Number(limit||10)),ttl=Math.max(1,Number(windowSeconds||60));
  const bucket=Math.floor(Date.now()/(ttl*1000));
  const key='ratelimit:'+safeScope+':'+identifierHash(identifier)+':'+bucket;
  try{
    const count=await kv.incr(key);
    if(count===1)await kv.expire(key,ttl+5);
    return {limited:count>max,count,limit:max,retryAfter:ttl};
  }catch(err){
    console.error('rate limit unavailable',safeScope,err&&err.message||err);
    return {limited:false,count:0,limit:max,retryAfter:ttl,degraded:true};
  }
}
module.exports={rateLimit,requestIp,identifierHash};
