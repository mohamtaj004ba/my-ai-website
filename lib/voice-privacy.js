function redact(value,env=process.env){
  let s=String(value||'');
  const secrets=Object.keys(env).filter(name=>/(?:SECRET|TOKEN|PRIVATE_KEY|API_KEY|PASSWORD|DATABASE_URL|REDIS_URL)/.test(name)&&!/(?:^|_)PUBLIC(?:_|$)/.test(name)).map(name=>env[name]).filter(secret=>typeof secret==='string'&&secret.length>=12).sort((a,b)=>b.length-a.length);
  for(const secret of secrets)s=s.split(secret).join('[redacted]');
  return s.replace(/\b(?:sk|rk)_(?:live|test)_[a-zA-Z0-9_]+\b/g,'[redacted]').replace(/\bsk-[a-zA-Z0-9_-]{16,}\b/g,'[redacted]').replace(/\bBearer\s+[a-zA-Z0-9._-]{20,}/gi,'[redacted]');
}
module.exports={redact};
