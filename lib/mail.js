const https=require('https');
const MAILGUN_API_KEY=process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN=process.env.MAILGUN_DOMAIN||'mail.callercore.com';
function sendMail({to,subject,text,html}){return new Promise((resolve,reject)=>{if(!MAILGUN_API_KEY)return reject(new Error('MAILGUN_API_KEY missing'));const auth=Buffer.from('api:'+MAILGUN_API_KEY).toString('base64');const params=new URLSearchParams({from:'CallerCore <support@callercore.com>',to,subject,text,html}).toString();const req=https.request({hostname:'api.mailgun.net',path:'/v3/'+MAILGUN_DOMAIN+'/messages',method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(params)}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>res.statusCode>=200&&res.statusCode<300?resolve(body):reject(new Error('Mailgun '+res.statusCode+': '+body)))});req.on('error',reject);req.write(params);req.end()})}
module.exports={sendMail};
