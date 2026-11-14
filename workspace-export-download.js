(function(root){
  const busy=new WeakSet();
  async function download({url,button,status=()=>{},current=()=>true},{fetchImpl=root.fetch.bind(root),document=root.document,URL=root.URL,Blob=root.Blob,schedule=root.setTimeout.bind(root)}={}){
    if(busy.has(button))return false;
    busy.add(button);const disabled=button.disabled;button.disabled=true;const controller=new AbortController(),timer=schedule(()=>controller.abort(),60000);
    const say=(text,error=false)=>{if(current())status(text,error)};
    say('Preparing your workspace download…');
    try{
      const response=await fetchImpl(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
      if(!response.ok){say(response.status===401?'Sign in again to download your workspace data.':response.status===403?'Your account cannot download this workspace.':'No file was downloaded. The workspace could not be verified; refresh and try again.',true);return false}
      let data;try{data=await response.json()}catch{say('No file was downloaded. The export response could not be verified.',true);return false}
      if(data?.exportVersion!=='1.0'||!data.workspace||typeof data.workspace!=='object'||typeof data.workspace.id!=='string'){say('No file was downloaded. The export response could not be verified.',true);return false}
      if(!current())return false;
      const disposition=response.headers.get('content-disposition')||'',name=disposition.match(/filename="([A-Za-z0-9._-]+\.json)"/)?.[1]||'CallerCore-workspace-data.json';
      const objectURL=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');
      try{link.href=objectURL;link.download=name;document.body.append(link);link.click();say('Your workspace download is ready. Keep this file in a private, secure location.');return true}
      finally{link.remove();schedule(()=>URL.revokeObjectURL(objectURL),60000)}
    }catch{say('No file was downloaded. The connection could not be confirmed; try again when you are connected.',true);return false}
    finally{root.clearTimeout(timer);busy.delete(button);button.disabled=disabled}
  }
  if(typeof module==='object'&&module.exports)module.exports={download};else root.CallerCoreExports={download};
})(typeof window==='object'?window:globalThis);
