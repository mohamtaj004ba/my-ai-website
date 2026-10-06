const crypto=require('crypto');
// Short-lived, disposable acceptance scope. No production gate can be opened here.
const RUN='202610052626520a';
const EXPIRES=1791274934875;
const TOKEN_HASH='f5bb0987401e4aa4ef4041f3c4b35f1e8d78a15fc085229b3590e5133d63e683';
function allowed(req,env=process.env,now=Date.now()){
  if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/callercore-dashboards'||now>=EXPIRES)return false;
  const host=String(req.headers?.['x-forwarded-host']||req.headers?.host||'').split(',')[0].trim();
  if(!host.endsWith('.vercel.app'))return false;
  const cookie=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('cc_billing_acceptance='))?.slice(22);
  const token=String(req.headers?.['x-billing-acceptance']||cookie||'');
  if(!/^[a-f0-9]{64}$/.test(token))return false;
  const actual=crypto.createHash('sha256').update(token).digest();
  return crypto.timingSafeEqual(actual,Buffer.from(TOKEN_HASH,'hex'));
}
function testEmail(value){return typeof value==='string'&&new RegExp('^stripe-acceptance-'+RUN+'-(starter|growth|pro|recovery|auth|abandoned)@callercore\\.test$').test(value)}
function checkoutAllowed(req,env=process.env,now=Date.now()){return allowed(req,env,now)&&req.body?.native===true&&testEmail(req.body?.email)}
module.exports={RUN,EXPIRES,allowed,testEmail,checkoutAllowed};
