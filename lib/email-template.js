const BRAND={
  name:'CallerCore',
  orange:'#D2673C',
  ink:'#111827',
  muted:'#667085',
  line:'#E7E7E2',
  paper:'#F7F4EC',
  dark:'#101317',
  site:'https://www.callercore.com',
  support:'support@callercore.com',
  hello:'hello@callercore.com',
  sales:'sales@callercore.com',
  logo:'https://www.callercore.com/logo-icon.png'
};
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function stripHtml(s=''){return String(s).replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim()}
function button(label,url){if(!label||!url)return'';return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px"><tr><td style="border-radius:10px;background:'+BRAND.orange+'"><a href="'+esc(url)+'" style="display:inline-block;padding:13px 18px;font:700 14px Arial,sans-serif;color:#fff;text-decoration:none;border-radius:10px">'+esc(label)+'</a></td></tr></table>'}
function secondaryButton(label,url){if(!label||!url)return'';return '<a href="'+esc(url)+'" style="display:inline-block;margin-top:10px;padding:11px 15px;border:1px solid '+BRAND.line+';border-radius:9px;font:700 13px Arial,sans-serif;color:'+BRAND.ink+';text-decoration:none">'+esc(label)+'</a>'}
function supportBlock({siteUrl=BRAND.site,showDashboard=true}={}){
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;background:#FFF8F4;border:1px solid #F0D5C8;border-radius:12px"><tr><td style="padding:18px 20px">'+
    '<div style="font:700 13px Arial,sans-serif;color:'+BRAND.ink+';margin-bottom:6px">Questions or concerns? We’re here.</div>'+
    '<div style="font:400 12px/1.65 Arial,sans-serif;color:'+BRAND.muted+'">Reply directly to this email or contact us anytime at <a href="mailto:'+BRAND.support+'" style="color:'+BRAND.orange+';text-decoration:none">'+BRAND.support+'</a>. For general questions, you can also reach <a href="mailto:'+BRAND.hello+'" style="color:'+BRAND.orange+';text-decoration:none">'+BRAND.hello+'</a>'+(showDashboard?' or use <a href="'+esc(siteUrl)+'/dashboard" style="color:'+BRAND.orange+';text-decoration:none">Help &amp; Support in your CallerCore dashboard</a>':'')+'.</div>'+
    '</td></tr></table>';
}
function brandedEmail({
  preheader='',eyebrow='CALLERCORE',title='',intro='',bodyHtml='',statusLabel='',statusText='',
  ctaLabel='',ctaUrl='',secondaryLabel='',secondaryUrl='',siteUrl=BRAND.site,
  showSupport=true,showDashboardSupport=true,footerNote='AI-powered customer communications for service businesses.'
}={}){
  const support=showSupport?supportBlock({siteUrl,showDashboard:showDashboardSupport}):'';
  const status=statusLabel||statusText
    ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0;background:#F8FAFC;border:1px solid '+BRAND.line+';border-radius:12px"><tr><td style="padding:16px 18px"><div style="font:700 10px Arial,sans-serif;letter-spacing:.12em;color:'+BRAND.orange+';text-transform:uppercase">'+esc(statusLabel||'STATUS')+'</div><div style="font:600 13px/1.5 Arial,sans-serif;color:'+BRAND.ink+';margin-top:5px">'+esc(statusText)+'</div></td></tr></table>'
    :'';
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title||BRAND.name)+'</title></head>'+
  '<body style="margin:0;padding:0;background:'+BRAND.paper+'"><div style="display:none;max-height:0;overflow:hidden;opacity:0">'+esc(preheader)+'</div>'+
  '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:'+BRAND.paper+';padding:28px 12px"><tr><td align="center">'+
  '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border:1px solid '+BRAND.line+';border-radius:18px;overflow:hidden">'+
  '<tr><td style="background:'+BRAND.dark+';padding:22px 28px"><table role="presentation" width="100%"><tr><td><img src="'+BRAND.logo+'" width="34" height="34" alt="CallerCore" style="display:block;border:0"></td><td align="right" style="font:700 18px Arial,sans-serif;color:#fff">Caller<span style="color:'+BRAND.orange+'">Core</span></td></tr></table></td></tr>'+
  '<tr><td style="height:4px;background:'+BRAND.orange+'"></td></tr>'+
  '<tr><td style="padding:34px 32px 30px">'+
  '<div style="font:700 10px Arial,sans-serif;letter-spacing:.13em;color:'+BRAND.orange+';text-transform:uppercase;margin-bottom:10px">'+esc(eyebrow)+'</div>'+
  '<h1 style="margin:0 0 14px;font:700 28px/1.15 Arial,sans-serif;letter-spacing:-.02em;color:'+BRAND.ink+'">'+esc(title)+'</h1>'+
  (intro?'<p style="margin:0 0 18px;font:400 15px/1.65 Arial,sans-serif;color:'+BRAND.muted+'">'+intro+'</p>':'')+
  status+
  '<div style="font:400 14px/1.7 Arial,sans-serif;color:'+BRAND.ink+'">'+bodyHtml+'</div>'+
  button(ctaLabel,ctaUrl)+secondaryButton(secondaryLabel,secondaryUrl)+support+
  '</td></tr>'+
  '<tr><td style="padding:20px 32px;border-top:1px solid '+BRAND.line+';background:#FCFCFA"><div style="font:400 11px/1.6 Arial,sans-serif;color:#8A8F98">'+esc(footerNote)+'</div><div style="margin-top:8px;font:400 11px Arial,sans-serif;color:#8A8F98"><a href="'+BRAND.site+'" style="color:#8A8F98;text-decoration:none">callercore.com</a> &nbsp;·&nbsp; <a href="mailto:'+BRAND.support+'" style="color:#8A8F98;text-decoration:none">'+BRAND.support+'</a></div></td></tr>'+
  '</table></td></tr></table></body></html>';
  const textParts=[title,intro&&stripHtml(intro),statusText&&((statusLabel?statusLabel+': ':'')+statusText),stripHtml(bodyHtml),ctaLabel&&ctaUrl&&(ctaLabel+': '+ctaUrl),secondaryLabel&&secondaryUrl&&(secondaryLabel+': '+secondaryUrl)];
  if(showSupport)textParts.push('Questions or concerns? Reply to this email, email '+BRAND.support+', or reach '+BRAND.hello+(showDashboardSupport?' / Help & Support in your CallerCore dashboard.':'.'));
  textParts.push(BRAND.site);
  return {html,text:textParts.filter(Boolean).join('\n\n')};
}
function lifecycleEmail(opts={}){return brandedEmail({...opts,eyebrow:opts.eyebrow||'CLIENT SETUP'})}
function authEmail(opts={}){return brandedEmail({...opts,eyebrow:opts.eyebrow||'SECURE ACCOUNT ACCESS'})}
function outreachEmail(opts={}){return brandedEmail({...opts,eyebrow:opts.eyebrow||'CALLERCORE',showDashboardSupport:false})}
module.exports={BRAND,brandedEmail,lifecycleEmail,authEmail,outreachEmail,esc,stripHtml};