export function previewRequestHeaders(url,headers,previewURL){
  if(new URL(url).origin===new URL(previewURL).origin)return {...headers};
  return Object.fromEntries(Object.entries(headers).filter(([name])=>!['x-vercel-protection-bypass','x-vercel-set-bypass-cookie','x-qa-secret','x-bootstrap-secret'].includes(name.toLowerCase())));
}
// Header overrides on route.continue survive redirects. Keep credentials on a
// separate, non-following same-origin fetch, not on the browser request itself.
// Fulfilling the original response preserves native URL/Set-Cookie behavior;
// redirected browser requests have no inherited custom protection headers.
export async function installPreviewAccess(context,previewURL,credentials={}){
  const origin=new URL(previewURL).origin;
  await context.setExtraHTTPHeaders({});
  await context.route('**/*',async route=>{
    const request=route.request(),url=request.url(),headers=previewRequestHeaders(url,request.headers(),previewURL);
    try{
      if(new URL(url).origin!==origin){await route.continue({headers});return;}
      Object.assign(headers,credentials);
      if(Object.keys(headers).some(k=>k.toLowerCase()==='x-vercel-protection-bypass'))headers['x-vercel-set-bypass-cookie']='true';
      const response=await route.fetch({headers,maxRedirects:0,timeout:30000});
      await route.fulfill({response});
    }catch{try{await route.abort('failed');}catch{}throw Error('Protected Preview request handling failed');}
  });
}
