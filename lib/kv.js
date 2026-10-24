// Central CallerCore KV boundary.
// Preview must use the isolated Preview Upstash resource and must never
// silently fall back to Production KV credentials.
const isPreview=String(process.env.VERCEL_ENV||'').toLowerCase()==='preview';

if(isPreview){
  const mapping={
    KV_REST_API_URL:'PREVIEW_KV_KV_REST_API_URL',
    KV_REST_API_TOKEN:'PREVIEW_KV_KV_REST_API_TOKEN',
    KV_REST_API_READ_ONLY_TOKEN:'PREVIEW_KV_KV_REST_API_READ_ONLY_TOKEN',
    KV_URL:'PREVIEW_KV_KV_URL',
    REDIS_URL:'PREVIEW_KV_REDIS_URL'
  };
  const missing=[];
  for(const [standard,prefixed] of Object.entries(mapping)){
    const value=process.env[prefixed];
    if(!value)missing.push(prefixed);
    else process.env[standard]=value;
  }
  if(missing.length){
    throw new Error('Preview KV isolation credentials missing: '+missing.join(', '));
  }
}

const {Redis}=require('@upstash/redis');

const redisUrl=String(process.env.KV_REST_API_URL||'').trim();
const redisToken=String(process.env.KV_REST_API_TOKEN||'').trim();
if(!redisUrl||!redisToken){
  throw new Error('CallerCore Redis credentials missing: KV_REST_API_URL or KV_REST_API_TOKEN');
}
const kv=new Redis({url:redisUrl,token:redisToken,enableTelemetry:false});

function storageEnvironment(){
  return isPreview?'preview-isolated':'standard';
}

module.exports={kv,storageEnvironment,isPreview};
