const { sendMail } = require('./_lib/mailgun');

const ALLOWED_HOSTS = new Set(['callercore.com','www.callercore.com','localhost:3000','localhost']);
function allowed(req){const c=req.headers.origin||req.headers.referer||'';if(!c)return false;try{const h=new URL(c).host;return ALLOWED_HOSTS.has(h)||h.endsWith('.vercel.app')}catch(e){return false}}
function clean(v,n=2000){return String(v||'').trim().slice(0,n)}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!allowed(req))return res.status(403).json({error:'Forbidden'});
 const name=clean(req.body?.name,120),business=clean(req.body?.business,160),email=clean(req.body?.email,200),phone=clean(req.body?.phone,80),category=clean(req.body?.category,80),message=clean(req.body?.message,4000);
 if(!name||!email||!message||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Please complete the required fields'});
 const text=['New CallerCore website inquiry','','Category: '+category,'Name: '+name,'Business: '+business,'Email: '+email,'Phone: '+phone,'','Message:',message].join('\n');
 try{await sendMail({to:'support@callercore.com',subject:'Website inquiry — '+(category||'General')+' — '+(business||name),text,html:'<p><b>New CallerCore website inquiry</b></p><p><b>Category:</b> '+escapeHtml(category)+'<br><b>Name:</b> '+escapeHtml(name)+'<br><b>Business:</b> '+escapeHtml(business)+'<br><b>Email:</b> '+escapeHtml(email)+'<br><b>Phone:</b> '+escapeHtml(phone)+'</p><p><b>Message</b><br>'+escapeHtml(message).replace(/\n/g,'<br>')+'</p>'});return res.status(200).json({ok:true})}catch(e){console.error('contact send failed',e);return res.status(500).json({error:'Unable to send'})}
};
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}