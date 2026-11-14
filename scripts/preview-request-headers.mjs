export function previewRequestHeaders(url,headers,previewURL){
  if(new URL(url).origin===new URL(previewURL).origin)return {...headers};
  return Object.fromEntries(Object.entries(headers).filter(([name])=>!['x-vercel-protection-bypass','x-vercel-set-bypass-cookie','x-qa-secret','x-bootstrap-secret'].includes(name.toLowerCase())));
}

export function postProtectedPreview(request, previewURL, url, headers, data){
  if(new URL(url).origin!==new URL(previewURL).origin)throw Error('PREVIEW_QA_API_ORIGIN_DENIED');
  return Promise.resolve().then(()=>request.post(url,{headers,data,maxRedirects:0,maxRetries:0,timeout:30000})).catch(()=>{
    throw Error('PREVIEW_QA_API_TRANSPORT_FAILED');
  });
}

export async function readProtectedPreviewJson(response){
  try{return await response.json();}catch{throw Error('PREVIEW_QA_API_INVALID_JSON');}
}
// Header overrides on route.continue survive redirects. Keep credentials on a
// separate, non-following same-origin fetch, not on the browser request itself.
// Fulfilling the original response preserves native URL/Set-Cookie behavior;
// redirected browser requests have no inherited custom protection headers.
const accessStates=new WeakMap();
export async function closePreviewPage(context,page){
  accessStates.get(context)?.closingPages.add(page);
  try{await page.close();}catch{throw Error('PREVIEW_ACCESS_CLEANUP_FAILED');}
  await assertPreviewAccessHealthy(context);
}
export async function closePreviewAccess(context){
  const state=accessStates.get(context);if(state)state.closing=true;
  try{await context.close();}catch{throw Error('PREVIEW_ACCESS_CLEANUP_FAILED');}
  await assertPreviewAccessHealthy(context);
}
export async function assertPreviewAccessHealthy(context){
  const state=accessStates.get(context);if(!state)return;
  await Promise.all([...state.pending]);
  if(state.failureCount)throw Error('PREVIEW_ACCESS_TRANSPORT_FAILED: '+JSON.stringify({count:state.failureCount,failures:state.failures}));
}
export function previewAccessDiagnostics(context){const state=accessStates.get(context);return state?{failureCount:state.failureCount,cancelledCount:state.cancelledCount,failures:state.failures.map(x=>({...x}))}:null;}
export async function installPreviewAccess(context,previewURL,credentials={}){
  const origin=new URL(previewURL).origin;
  const state={closing:false,closingPages:new WeakSet(),pending:new Set(),failureCount:0,cancelledCount:0,failures:[]};accessStates.set(context,state);
  await context.setExtraHTTPHeaders({});
  await context.route('**/*',route=>{const pending=handle(route).finally(()=>state.pending.delete(pending));state.pending.add(pending);return pending;});
  async function handle(route){
    let phase='request',scope='unknown',resource='unknown',method='unknown',request,requestPage;
    try{
      request=route.request();const url=request.url(),parsed=new URL(url),headers=previewRequestHeaders(url,request.headers(),previewURL);
      try{requestPage=request.frame().page();}catch{}
      scope=parsed.origin===origin?'preview':'foreign';resource=parsed.pathname.startsWith('/api/')?'api':'asset';
      const verb=request.method?.();method=['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(verb)?verb:'other';
      if(scope==='foreign'){phase='continue';await route.continue({headers});return;}
      Object.assign(headers,credentials);
      if(Object.keys(headers).some(k=>k.toLowerCase()==='x-vercel-protection-bypass'))headers['x-vercel-set-bypass-cookie']='true';
      phase='fetch';const response=await route.fetch({headers,maxRedirects:0,maxRetries:0,timeout:30000});
      phase='fulfill';await route.fulfill({response});
    }catch(error){
      // These are Playwright lifecycle classifications, never copied error text.
      const message=String(error?.message||''),closed=/^(?:route\.(?:fetch|fulfill|continue|abort): )?(?:Target page, context or browser has been closed|Target closed|Request context disposed\.)/.test(message);
      if((state.closing||requestPage&&state.closingPages.has(requestPage))&&closed)state.cancelledCount++;
      else{state.failureCount++;if(state.failures.length<20)state.failures.push({code:'PREVIEW_ACCESS_REQUEST_FAILED',phase,scope,resource,method,category:closed?'unexpected-closure':error?.name==='TimeoutError'||/^route\.fetch: Timeout \d+ms exceeded/.test(message)?'timeout':'transport'});}
      // Reject the network request, not the detached asynchronous route callback.
      // Callers check this ledger after cleanup so subresource failures cannot pass.
      try{await route.abort('failed');}catch{}
    }
  }
}
