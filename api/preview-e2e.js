module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').toLowerCase().split(',')[0].trim();
  if(process.env.VERCEL_ENV!=='preview'||!host.endsWith('.vercel.app'))return res.status(404).send('Not found');
  if(req.method!=='GET')return res.status(405).send('Method not allowed');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>CallerCore Preview E2E Launcher</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d10;color:#f5f7fa;margin:0;padding:32px}main{max-width:720px;margin:auto;background:#12161c;border:1px solid #2b313a;border-radius:18px;padding:28px}h1{margin-top:0}label{display:block;margin:18px 0 6px;color:#b9c2ce}input,select,button{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #38414c;background:#0d1117;color:#fff;font:inherit}button{margin-top:14px;background:#fff;color:#111;font-weight:700;cursor:pointer}button.secondary{background:#1a2028;color:#fff}.note{color:#98a4b3;line-height:1.5}.ok{color:#8ee59b}.err{color:#ff9d9d}pre{white-space:pre-wrap;background:#0a0d11;padding:14px;border-radius:10px;border:1px solid #252c35}
</style></head><body><main>
<h1>CallerCore Preview E2E Launcher</h1>
<p class="note">Preview only. Uses the isolated Preview KV store. The bootstrap secret stays in this browser session and is never displayed back by the page.</p>
<label>Preview bootstrap secret</label><input id="secret" type="password" autocomplete="off">
<label>Test email</label><input id="email" type="email" value="support@callercore.com">
<label>Business name</label><input id="business" value="CallerCore Preview E2E">
<label>Plan</label><select id="plan"><option>Growth</option><option>Starter</option><option>Pro</option></select>
<button id="create">1. Create disposable workspace</button>
<button class="secondary" id="promote">2. Promote test user to admin (optional)</button>
<button class="secondary" id="login">3. Send magic login link</button>
<pre id="out">Ready.</pre>
<script>
const q=new URLSearchParams(location.search),bypass=q.get('x-vercel-protection-bypass')||'';
const api=(action)=>'/api/account?action='+encodeURIComponent(action)+(bypass?'&x-vercel-protection-bypass='+encodeURIComponent(bypass):'');
const out=(msg,ok=true)=>{const el=document.getElementById('out');el.textContent=msg;el.className=ok?'ok':'err'};
const val=id=>document.getElementById(id).value.trim();
async function post(action,body,secretRequired=false){
 const headers={'content-type':'application/json'};
 if(secretRequired)headers['x-bootstrap-secret']=val('secret');
 const r=await fetch(api(action),{method:'POST',headers,body:JSON.stringify(body),credentials:'same-origin'});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
 return data;
}
document.getElementById('create').onclick=async()=>{try{
 const data=await post('bootstrap-preview',{email:val('email'),businessName:val('business'),plan:val('plan')},true);
 out('Workspace created.\nWorkspace ID: '+data.workspaceId+'\nEmail: '+data.email+'\nPlan: '+data.plan);
}catch(e){out(e.message,false)}};
document.getElementById('promote').onclick=async()=>{try{
 const data=await post('promote-preview-admin',{email:val('email')},true);
 out('Preview user promoted to admin.\n'+JSON.stringify(data,null,2));
}catch(e){out(e.message,false)}};
document.getElementById('login').onclick=async()=>{try{
 await post('request',{email:val('email'),next:'/dashboard'},false);
 out('Magic login link requested. Check the test mailbox.');
}catch(e){out(e.message,false)}};
</script></main></body></html>`);
};