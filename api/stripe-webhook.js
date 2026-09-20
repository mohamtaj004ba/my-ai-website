const crypto=require('crypto');
const {kv}=require('@vercel/kv');
const {sendMail}=require('../lib/mail');
const {normalizePlan,entitlementsFor}=require('../lib/plans');
module.exports.config={api:{bodyParser:false}};
const STRIPE_WEBHOOK_SECRET=process.env.STRIPE_WEBHOOK_SECRET;
const SITE_URL=process.env.SITE_URL||'https://www.callercore.com';
const PLAN_BY_PAYMENT_LINK={
  'plink_1To9m8F0BXlPng7VihxbmKPJ':'Starter',
  'plink_1To9pBF0BXlPng7VdkdBhHcx':'Growth',
  'plink_1To9qJF0BXlPng7VXXwBIHHf':'Pro'
};
function getRawBody(req){return new Promise((resolve,reject)=>{let data='';req.on('data',c=>data+=c);req.on('end',()=>resolve(data));req.on('error',reject)})}
function verifyStripeSignature(rawBody,sigHeader,secret){
  if(!sigHeader||!secret)return false;
  const parts=sigHeader.split(',').map(p=>p.split('=').map(s=>s.trim()));
  const timestamp=parts.find(([k])=>k==='t')?.[1];
  const signatures=parts.filter(([k])=>k==='v1').map(([,v])=>v);
  if(!timestamp||!signatures.length)return false;
  const ts=Number(timestamp);if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>300)return false;
  const expected=crypto.createHmac('sha256',secret).update(timestamp+'.'+rawBody).digest('hex');
  const expectedBuf=Buffer.from(expected,'hex');
  return signatures.some(sig=>{try{const got=Buffer.from(sig,'hex');return got.length===expectedBuf.length&&crypto.timingSafeEqual(got,expectedBuf)}catch(_){return false}})
}
async function upsertWorkspace({lead,session,plan,email}){
  const userKey='user:email:'+email;
  const existingMember=await kv.get(userKey);
  let workspaceId=existingMember&&existingMember.workspaceId;
  if(!workspaceId)workspaceId=crypto.randomUUID();
  const key='workspace:'+workspaceId;
  const existing=await kv.get(key)||{};
  const ent=entitlementsFor(plan);
  const workspace={
    ...existing,
    id:workspaceId,
    name:lead.business||existing.name||'CallerCore Client',
    ownerName:lead.name||existing.ownerName||'',
    ownerEmail:email,
    phone:lead.phone||existing.phone||'',
    industry:lead.industry||existing.industry||'',
    plan:ent.plan,
    status:existing.status||'onboarding',
    subscriptionStatus:'active',
    stripeCustomerId:session.customer||existing.stripeCustomerId||null,
    stripeSubscriptionId:session.subscription||existing.stripeSubscriptionId||null,
    stripeCheckoutSessionId:session.id,
    usage:existing.usage||{minutes:0},
    createdAt:existing.createdAt||Date.now(),
    updatedAt:Date.now()
  };
  await kv.set(key,workspace);
  await kv.set(userKey,{workspaceId,role:'owner',email});
  if(session.customer)await kv.set('stripe:customer:'+session.customer,workspaceId);
  if(session.subscription)await kv.set('stripe:subscription:'+session.subscription,workspaceId);
  return workspace;
}
module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const rawBody=await getRawBody(req);
  if(!verifyStripeSignature(rawBody,req.headers['stripe-signature'],STRIPE_WEBHOOK_SECRET))return res.status(400).json({error:'Invalid signature'});
  let event;try{event=JSON.parse(rawBody)}catch(_){return res.status(400).json({error:'Invalid payload'})}
  const checkoutEvent=event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded';
  if(!checkoutEvent)return res.status(200).json({received:true,ignored:true});
  const eventKey=event.id?'stripe:event:'+event.id:null;
  if(eventKey&&await kv.get(eventKey))return res.status(200).json({received:true,duplicate:true});
  const session=event.data.object;
  if(event.type==='checkout.session.completed'&&!['paid','no_payment_required'].includes(session.payment_status))return res.status(200).json({received:true,pending_payment:true});
  const paidPlan=normalizePlan(PLAN_BY_PAYMENT_LINK[session.payment_link]||'Starter');
  const sessionKey=session.id?'stripe:session:'+session.id:null;
  let sessionState=sessionKey?await kv.get(sessionKey):null;
  if(sessionState&&sessionState.status==='complete'){if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});return res.status(200).json({received:true,duplicate:true})}

  const leadId=session.client_reference_id;
  const customerEmail=String(session.customer_details?.email||'').trim().toLowerCase();
  let lead=null,token=sessionState?.token||null;
  if(token)lead=await kv.get('onboarding:'+token);
  if(!lead&&leadId)lead=await kv.get('lead:'+leadId);
  if(!lead)lead={name:session.customer_details?.name||'',business:'',email:customerEmail,phone:session.customer_details?.phone||'',industry:'',plan:paidPlan};
  lead.plan=paidPlan;
  const recipient=String(lead.email||customerEmail||'').trim().toLowerCase();
  if(!recipient)return res.status(500).json({error:'Missing customer email'});

  const workspace=await upsertWorkspace({lead,session,plan:paidPlan,email:recipient});

  if(!token){
    token=crypto.randomBytes(24).toString('hex');
    await kv.set('onboarding:'+token,{...lead,workspaceId:workspace.id,stripeSessionId:session.id,agreementSigned:false,agreementSignedAt:null,intake:{},status:'awaiting_agreement',createdAt:Date.now()},{ex:60*60*24*30});
  }else{
    const onboarding=await kv.get('onboarding:'+token);
    if(onboarding&&!onboarding.workspaceId)await kv.set('onboarding:'+token,{...onboarding,workspaceId:workspace.id},{ex:60*60*24*30});
  }
  if(sessionKey)await kv.set(sessionKey,{token,workspaceId:workspace.id,status:'pending_email'},{ex:60*60*24*90});

  const magicLink=SITE_URL+'/onboarding?token='+token;
  const firstName=(lead.name||'').split(' ')[0]||'there';
  try{
    await sendMail({
      to:recipient,
      subject:'Welcome to CallerCore — your setup link',
      text:'Hi '+firstName+',\n\nWelcome to CallerCore — payment received.\n\nYour next steps: '+magicLink+'\n\nSign your service agreement and fill out your intake form there. We start building your AI the moment your intake form comes in — most accounts go live within 1 business day of that.\n\nYour CallerCore client account has also been created for '+workspace.name+'. Once setup is ready, you can sign in at '+SITE_URL+'/login.\n\nQuestions any time: support@callercore.com\n\n— Tj, CallerCore',
      html:'<p>Hi '+firstName+',</p><p>Welcome to CallerCore — payment received.</p><p><a href="'+magicLink+'">Click here for your next steps</a> — sign your service agreement and fill out your intake form.</p><p>Your CallerCore client account has also been created for <strong>'+workspace.name+'</strong>. Once setup is ready, you can sign in at <a href="'+SITE_URL+'/login">'+SITE_URL+'/login</a>.</p><p>Questions any time: support@callercore.com</p><p>— Tj, CallerCore</p>'
    });
  }catch(err){console.error('Failed to send onboarding email:',err);return res.status(500).json({error:'Onboarding email failed'})}

  if(sessionKey)await kv.set(sessionKey,{token,workspaceId:workspace.id,status:'complete'},{ex:60*60*24*90});
  if(eventKey)await kv.set(eventKey,true,{ex:60*60*24*90});
  return res.status(200).json({received:true,workspaceId:workspace.id});
};