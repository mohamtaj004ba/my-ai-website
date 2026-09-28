const https=require('https');
const MAILGUN_API_KEY=process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN=process.env.MAILGUN_DOMAIN||'notify.callercore.com';
function safeHeader(v,max=500){return String(v||'').replace(/[\r\n\0-\x1f\x7f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function deliveryError(message,deliveryState,code){
  const error=new Error(message);error.deliveryState=deliveryState;error.code=code;return error;
}
function sendMail({to,subject,text,html,from='CallerCore <support@callercore.com>',replyTo='support@callercore.com'}){
  return new Promise((resolve,reject)=>{
    if(!MAILGUN_API_KEY)return reject(deliveryError('MAILGUN_API_KEY missing','failed','MAIL_NOT_CONFIGURED'));
    const auth=Buffer.from('api:'+MAILGUN_API_KEY).toString('base64');
    const params=new URLSearchParams({
      from:safeHeader(from,320),to:safeHeader(to,320),subject:safeHeader(subject,500),
      text:String(text||''),html:String(html||''),'h:Reply-To':safeHeader(replyTo,320)
    }).toString();
    const req=https.request({hostname:'api.mailgun.net',path:'/v3/'+MAILGUN_DOMAIN+'/messages',method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(params)}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>res.statusCode>=200&&res.statusCode<300?resolve(body):reject(deliveryError('Mailgun '+res.statusCode+': '+body,'failed','MAIL_PROVIDER_REJECTED')))});
    req.on('error',err=>reject(deliveryError('Mailgun transport error: '+String(err&&err.message||'request failed'),'uncertain','MAIL_TRANSPORT_UNCERTAIN')));req.write(params);req.end()
  })
}
module.exports={sendMail};
