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

const {kv}=require('@vercel/kv');

function storageEnvironment(){
  return isPreview?'preview-isolated':'standard';
}

module.exports={kv,storageEnvironment,isPreview};
