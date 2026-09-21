const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const {sendMail}=require('../lib/mail');
const {brandedEmail,esc}=require('../lib/email-template');

module.exports.config={api:{bodyParser:false}};

const SECRET=process.env.VERCEL_ALERT_WEBHOOK_SECRET;
const ALERT_EMAIL=process.env.CALLERCORE_ALERT_EMAIL||'support@callercore.com';
const MAX_BYTES=128*1024;

function rawBody(req){
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>MAX_BYTES){reject(Object.assign(new Error('Payload too large'),{code:'TOO_LARGE'}));req.destroy();return}
      chunks.push(chunk);
    });
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}
function validSignature(body,header,secret){
  if(!secret||!header||typeof header!=='string')return false;
  const expected=crypto.createHmac('sha1',secret).update(body).digest('hex');
  if(header.length!==expected.length)return false;
  try{return crypto.timingSafeEqual(Buffer.from(header),Buffer.from(expected))}catch(_){return false}
}
function firstText(obj,paths){
  for(const path of paths){
    let cur=obj;
    for(const key of path.split('.'))cur=cur&&cur[key];
    if(typeof cur==='string'&&cur.trim())return cur.trim();
  }
  return '';
}
function summarize(payload){
  const name=firstText(payload,['name','alert.name','rule.name','title'])||'Vercel production alert';
  const type=firstText(payload,['type','alert.type','event.type','alertType'])||'anomaly';
  const project=firstText(payload,['project.name','projectName','project.name','projectId'])||'my-ai-website';
  const route=firstText(payload,['route','path','alert.route','event.route']);
  const message=firstText(payload,['message','description','alert.message','event.message']);
  const severity=firstText(payload,['severity','alert.severity'])||'high';
  return {name,type,project,route,message,severity};
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!SECRET)return res.status(503).json({error:'Alert webhook is not configured'});
  let body;
  try{body=await rawBody(req)}catch(err){return res.status(err&&err.code==='TOO_LARGE'?413:400).json({error:'Invalid request'})}
  const sig=req.headers['x-vercel-signature'];
  if(!validSignature(body,sig,SECRET))return res.status(403).json({error:'Invalid signature'});
  let payload;
  try{payload=JSON.parse(body.toString('utf8'))}catch(_){return res.status(400).json({error:'Invalid JSON'})}

  const hash=crypto.createHash('sha256').update(body).digest('hex');
  const dedupeKey='vercel:alert:'+hash;
  if(await kv.get(dedupeKey))return res.status(200).json({received:true,duplicate:true});
  await kv.set(dedupeKey,true,{ex:60*60*24*7});

  const info=summarize(payload);
  const details=[
    ['Project',info.project],
    ['Type',info.type],
    ['Severity',info.severity],
    ['Route',info.route||'Not supplied'],
    ['Message',info.message||'No message supplied']
  ];
  const rows=details.map(([k,v])=>'<tr><td style="padding:6px 12px 6px 0;font-weight:700;vertical-align:top">'+esc(k)+'</td><td style="padding:6px 0">'+esc(v)+'</td></tr>').join('');
  const email=brandedEmail({
    preheader:'CallerCore production monitoring detected a Vercel anomaly.',
    eyebrow:'PRODUCTION ALERT',
    title:'CallerCore production anomaly detected',
    intro:'Vercel triggered a production monitoring alert for CallerCore.',
    statusLabel:'Severity',
    statusText:String(info.severity||'high').toUpperCase(),
    bodyHtml:'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="font:13px/1.5 Arial,sans-serif;color:#111827">'+rows+'</table><p style="margin:18px 0 0">Review Vercel Observability and CallerCore System Health before taking corrective action.</p>',
    ctaLabel:'Open Vercel project',
    ctaUrl:'https://vercel.com/dashboard',
    showDashboardSupport:false,
    footerNote:'Internal CallerCore production monitoring alert.'
  });
  try{
    await sendMail({to:ALERT_EMAIL,subject:'[CallerCore ALERT] '+info.name,...email});
  }catch(err){
    console.error('Vercel alert email failed',err&&err.message||err);
    return res.status(502).json({error:'Alert delivery failed'});
  }
  return res.status(200).json({received:true});
};
