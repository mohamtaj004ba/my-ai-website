function redact(value,env=process.env){
  let s=String(value||'');
  for(const name of ['VAPI_PRIVATE_KEY','VAPI_API_KEY','OPENAI_API_KEY','CALLERCORE_VOICE_WEBHOOK_SECRET','STRIPE_SECRET_KEY']){const secret=env[name];if(typeof secret==='string'&&secret.length>=20)s=s.split(secret).join('[redacted]')}
  return s.replace(/\b(?:sk|rk)_(?:live|test)_[a-zA-Z0-9_]+\b/g,'[redacted]').replace(/\bsk-[a-zA-Z0-9_-]{16,}\b/g,'[redacted]').replace(/\bBearer\s+[a-zA-Z0-9._-]{20,}/gi,'[redacted]');
}
module.exports={redact};
