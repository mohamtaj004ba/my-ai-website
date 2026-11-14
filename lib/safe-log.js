function safeError(err){
  const raw=String(err&&err.message||err||'Unknown error');
  return raw
    .replace(/https?:\/\/\S+/gi,'[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,'[phone]')
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/g,'[secret]')
    .replace(/\bwhsec_[A-Za-z0-9_-]+\b/g,'[secret]')
    .replace(/\bkey-[A-Za-z0-9_-]+\b/g,'[secret]')
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g,'[secret]')
    .slice(0,500);
}
function upstreamCode(data){
  if(typeof data==='string'){try{data=JSON.parse(data)}catch{return 'upstream_error'}}
  const error=data&&data.error||{};
  const allowedTypes=new Set(['upstream_error','invalid_request_error','authentication_error','permission_error','not_found_error','rate_limit_error','overloaded_error','api_error','server_error','insufficient_quota','tokens','requests']);
  const allowedCodes=new Set(['invalid_api_key','insufficient_quota','model_not_found','rate_limit_exceeded','billing_hard_limit_reached','account_deactivated','context_length_exceeded','unsupported_value','invalid_value','invalid_parameter','invalid_request_error']);
  const rawType=String(error.type||data&&data.type||'upstream_error'),rawCode=String(error.code||data&&data.code||'');
  const type=allowedTypes.has(rawType)?rawType:'upstream_error',code=allowedCodes.has(rawCode)?rawCode:'';
  return code?type+':'+code:type;
}
module.exports={safeError,upstreamCode};
