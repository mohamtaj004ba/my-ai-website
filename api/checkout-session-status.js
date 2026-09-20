const https = require('https');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ALLOWED_HOSTS = new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);

function isAllowedOrigin(req){
  const candidate=req.headers.origin||req.headers.referer||'';
  if(!candidate) return false;
  try{
    const host=new URL(candidate).host;
    return ALLOWED_HOSTS.has(host)||host.endsWith('.vercel.app');
  }catch(_){ return false; }
}
function stripeGet(path){
  return new Promise((resolve,reject)=>{
    const req=https.request({
      hostname:'api.stripe.com',
      path,
      method:'GET',
      headers:{'Authorization':`Bearer ${STRIPE_SECRET_KEY}`}
    },res=>{
      let data='';
      res.on('data',chunk=>{data+=chunk});
      res.on('end',()=>{
        let parsed;
        try{parsed=JSON.parse(data)}catch(_){return reject(new Error('Invalid Stripe response'))}
        if(res.statusCode<200||res.statusCode>=300) return reject(new Error(parsed.error?.message||'Stripe request failed'));
        resolve(parsed);
      });
    });
    req.on('error',reject);
    req.setTimeout(10000,()=>req.destroy(new Error('Stripe request timed out')));
    req.end();
  });
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const origin=req.headers.origin||'';
  if(isAllowedOrigin(req)&&origin) res.setHeader('Access-Control-Allow-Origin',origin);

  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  if(!isAllowedOrigin(req)) return res.status(403).json({error:'Forbidden'});
  if(!STRIPE_SECRET_KEY) return res.status(503).json({error:'Checkout status unavailable'});

  const sessionId=String(req.query?.session_id||'').trim();
  if(!/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(sessionId)) return res.status(400).json({error:'Invalid session'});

  try{
    const session=await stripeGet('/v1/checkout/sessions/'+encodeURIComponent(sessionId));
    return res.status(200).json({
      status:session.status,
      paymentStatus:session.payment_status,
      customerEmail:session.customer_details?.email||session.customer_email||''
    });
  }catch(err){
    console.error('Checkout status lookup failed:',err);
    return res.status(502).json({error:'Unable to verify checkout'});
  }
};