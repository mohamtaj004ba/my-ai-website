const {compareAndSetConfig}=require('./config-transaction');

// Admin reads also record the current monthly finance snapshot. Competing reads
// must not overwrite a newer history or silently drop earlier recorded months.
async function recordFinanceSnapshot(kv,initialHistory,snapshot,{attempts=3}={}){
  let current=initialHistory;
  const maxAttempts=Math.max(1,Math.min(5,Number(attempts)||3));
  for(let attempt=0;attempt<maxAttempts;attempt++){
    if(current!==null&&current!==undefined&&!Array.isArray(current))throw new Error('Finance history is malformed');
    const history=Array.isArray(current)?current:[];
    const sameMonth=history.find(row=>row&&row.month===snapshot.month);
    if(Number(sameMonth?.recordedAt||0)>=Number(snapshot.recordedAt||0))return history.slice().sort((a,b)=>String(a.month).localeCompare(String(b.month))).slice(-24);
    const updated=[...history.filter(row=>row&&row.month!==snapshot.month),snapshot].sort((a,b)=>String(a.month).localeCompare(String(b.month))).slice(-24);
    if(await compareAndSetConfig(kv,[{key:'finance:history',before:current,after:updated}]))return updated;
    current=await kv.get('finance:history');
  }
  throw new Error('Finance history changed during refresh');
}

module.exports={recordFinanceSnapshot};
