function safeError(err){
  const raw=String(err&&err.message||err||'Unknown error');
  return raw
    .replace(/https?:\/\/\S+/gi,'[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,'[phone]')
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/g,'[secret]')
    .replace(/\bwhsec_[A-Za-z0-9_-]+\b/g,'[secret]')
    .replace(/\bkey-[A-Za-z0-9_-]+\b/g,'[secret]')
    .slice(0,500);
}
function upstreamCode(data){
  const error=data&&data.error||{};
  const type=String(error.type||data&&data.type||'upstream_error').slice(0,80);
  const code=String(error.code||data&&data.code||'').slice(0,80);
  return code?type+':'+code:type;
}
module.exports={safeError,upstreamCode};
