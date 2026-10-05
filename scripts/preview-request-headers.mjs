export function previewRequestHeaders(url,headers,previewURL){
  if(new URL(url).origin===new URL(previewURL).origin)return {...headers};
  return Object.fromEntries(Object.entries(headers).filter(([name])=>!['x-vercel-protection-bypass','x-vercel-set-bypass-cookie'].includes(name.toLowerCase())));
}
