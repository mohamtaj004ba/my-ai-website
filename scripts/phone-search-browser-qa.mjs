import assert from 'node:assert/strict';
// Existing authenticated fictional Preview rows only. No routes, seeding, model calls or record mutations.
export async function verifyPhoneSearch({page,ensureView}){
 const checks=[];
 const cases=[
  {view:'calls',search:'#callSearch',rows:'#callsTable [data-call-id]',identity:'data-call-id',filters:['#callDateFilter','#callCategoryFilter','#callFilter']},
  {view:'contacts',search:'#contactSearch',rows:'#contactsTable [data-contact-key]',identity:'data-contact-key',filters:['#contactTypeFilter']},
  {view:'leads',search:'#leadSearch',rows:'#leadKanban .followup-card',identity:'data-contact-key',identityChild:'[data-contact-key]',filters:['#leadFilter']},
  {view:'conversations',search:'#conversationSearch',rows:'#conversationThreads [data-thread-id]',identity:'data-thread-id',filters:[]}
 ];
 async function settle(c,previous,changed){if(c.view==='conversations')await page.waitForFunction(({previous,changed})=>!conversationPageLoading&&!conversationPageError&&(!conversationBackendPaging||((!changed||conversationPageRequest>previous)&&conversationLastFilterSignature===JSON.stringify([(document.querySelector('#conversationSearch')?.value||'').trim().toLowerCase(),conversationFilter,document.querySelector('#conversationSort')?.value||'newest']))),{previous,changed});}
 async function query(c,value){const previous=c.view==='conversations'?await page.evaluate(()=>conversationPageRequest):0,current=await page.locator(c.search).inputValue(),changed=current.trim().toLowerCase()!==value.trim().toLowerCase();await page.locator(c.search).fill(value);await settle(c,previous,changed);return page.locator(c.rows).evaluateAll((rows,c)=>rows.map(row=>(c.identityChild?row.querySelector(c.identityChild):row)?.getAttribute(c.identity)).filter(Boolean).sort(),c);}
 for(const c of cases){
  await ensureView(page,c.view);
  const saved={query:await page.locator(c.search).inputValue(),filters:await Promise.all(c.filters.map(async selector=>({selector,value:await page.locator(selector).inputValue()}))),status:c.view==='leads'?await page.locator('[data-followup-filter][aria-pressed="true"]').getAttribute('data-followup-filter'):c.view==='conversations'?await page.locator('[data-conversation-filter][aria-pressed="true"]').getAttribute('data-conversation-filter'):null};
  try{
   for(const f of saved.filters)await page.locator(f.selector).selectOption('all');
   if(c.view==='leads')await page.locator('[data-followup-filter="pending"]').click();
   if(c.view==='conversations'){const previous=await page.evaluate(()=>conversationPageRequest),changed=saved.status!=='all';await page.locator('[data-conversation-filter="all"]').click();await settle(c,previous,changed);}
   await query(c,'');
   const chosen=await page.locator(c.rows).evaluateAll((rows,c)=>{for(const row of rows){const phone=row.textContent.match(/\(509\) 555-\d{4}/)?.[0],id=(c.identityChild?row.querySelector(c.identityChild):row)?.getAttribute(c.identity);if(phone&&id)return{phone,id};}return null;},c);
   assert(chosen,c.view+': existing fictional formatted phone row required; no substitute evidence permitted');
   const formatted=await query(c,chosen.phone),digits=await query(c,chosen.phone.replace(/\D/g,''));
   assert(formatted.includes(chosen.id),c.view+': formatted query lost original row');
   assert(digits.includes(chosen.id),c.view+': digits query lost original row');
   assert.deepEqual(digits,formatted,c.view+': formatting changed matching row identities');
   checks.push({view:c.view,matchedIdentities:digits.length,originalRowPresent:true,formattedAndDigitsEquivalent:true,actualRenderedRows:true});
  }finally{
   for(const f of saved.filters)await page.locator(f.selector).selectOption(f.value);
   if(c.view==='leads'&&saved.status)await page.locator('[data-followup-filter="'+saved.status+'"]').click();
   if(c.view==='conversations'&&saved.status){const previous=await page.evaluate(()=>conversationPageRequest),changed=await page.locator('[data-conversation-filter="'+saved.status+'"]').getAttribute('aria-pressed')!=='true';await page.locator('[data-conversation-filter="'+saved.status+'"]').click();await settle(c,previous,changed);}
   await query(c,saved.query);
  }
 }
 await ensureView(page,'leads');
 return{qualification:'Real rendered product search with existing synthetic authenticated Preview records; no new seed, customer mutation or simulated match.',checks};
}
