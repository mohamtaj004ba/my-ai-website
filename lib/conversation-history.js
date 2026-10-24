const crypto=require('crypto');

const DEFAULT_LIMIT=50;
const MAX_LIMIT=100;

function timestamp(value){
  const numeric=Number(value);
  if(Number.isFinite(numeric)&&numeric>0)return numeric;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:0;
}

function conversationActivity(item={}){
  const base=Math.max(timestamp(item.activityAt),timestamp(item.updatedAt),timestamp(item.createdAt),timestamp(item.at),timestamp([item.date,item.time].filter(Boolean).join(' ')));
  return (Array.isArray(item.messages)?item.messages:[]).reduce((latest,message)=>Math.max(latest,timestamp(message&&message.at)),base);
}

function normalizedLimit(value){
  const limit=Number.parseInt(value,10);
  return Number.isFinite(limit)?Math.min(MAX_LIMIT,Math.max(1,limit)):DEFAULT_LIMIT;
}

function normalizedOptions(query={}){
  const filter=['all','attention','active','closed'].includes(String(query.filter||'').toLowerCase())?String(query.filter).toLowerCase():'all';
  const sort=String(query.sort||'').toLowerCase()==='oldest'?'oldest':'newest';
  return {q:String(query.q||'').trim().toLowerCase().slice(0,200),filter,sort,limit:normalizedLimit(query.limit)};
}

function fingerprint(options){
  return crypto.createHash('sha256').update([options.q,options.filter,options.sort].join('\n')).digest('base64url').slice(0,16);
}

function encodeCursor(offset,signature){
  return Buffer.from(JSON.stringify({o:offset,s:signature})).toString('base64url');
}

function decodeCursor(value,signature){
  if(!value)return 0;
  try{
    const raw=String(value);if(raw.length>512)throw new Error('invalid');
    const parsed=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
    if(!Number.isSafeInteger(parsed.o)||parsed.o<0||parsed.s!==signature)throw new Error('invalid');
    return parsed.o;
  }catch(_){
    const error=new Error('Invalid or expired conversation cursor');error.code='INVALID_CURSOR';throw error;
  }
}

function matches(item,options){
  const status=String(item&&item.status||'').trim().toLowerCase();
  if(options.filter==='attention'&&!/follow/.test(status))return false;
  if(options.filter==='active'&&status!=='active')return false;
  if(options.filter==='closed'&&status!=='closed')return false;
  if(!options.q)return true;
  const messages=Array.isArray(item&&item.messages)?item.messages:[];
  return [item&&item.name,item&&item.phone,item&&item.last,item&&item.status,...messages.map(message=>message&&message.text)].join(' ').toLowerCase().includes(options.q);
}

function conversationSummary(item={}){
  const source=item&&typeof item==='object'&&!Array.isArray(item)?item:{},safeMessages=Array.isArray(source.messages)?source.messages:[];
  const storedCount=Number(source.messageCount),messageCount=safeMessages.length?safeMessages.length:(Number.isSafeInteger(storedCount)&&storedCount>=0?storedCount:0);
  return {id:source.id,name:source.name,phone:source.phone,address:source.address,status:source.status,last:source.last,time:source.time,createdAt:source.createdAt,updatedAt:source.updatedAt,messageCount,activityAt:conversationActivity(source)};
}

function conversationContactKey(item={}){
  const phone=String(item.phone||'').replace(/\D/g,'');if(phone)return 'p:'+phone;
  return 'n:'+String(item.name||item.caller||'unknown').trim().toLowerCase().replace(/\s+/g,' ');
}

function paginateConversations(items,query={}){
  const options=normalizedOptions(query),signature=fingerprint(options),offset=decodeCursor(query.cursor,signature);
  const rows=(Array.isArray(items)?items:[]).filter(item=>item&&matches(item,options)).map((item,index)=>({item,index,activity:conversationActivity(item)}));
  rows.sort((a,b)=>options.sort==='oldest'?(a.activity-b.activity||a.index-b.index):(b.activity-a.activity||a.index-b.index));
  const total=rows.length,start=Math.min(offset,total),page=rows.slice(start,start+options.limit).map(row=>conversationSummary(row.item)),nextOffset=start+page.length;
  return {conversations:page,total,nextCursor:nextOffset<total?encodeCursor(nextOffset,signature):null,limit:options.limit};
}

function paginateMessages(conversation,query={}){
  const messages=Array.isArray(conversation&&conversation.messages)?conversation.messages:[],limit=normalizedLimit(query.limit);
  let end=messages.length;
  if(query.cursor){
    try{
      const raw=String(query.cursor);if(raw.length>512)throw new Error('invalid');
      const parsed=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
      if(!Number.isSafeInteger(parsed.e)||parsed.e<0||parsed.e>messages.length||String(parsed.i)!==String(conversation&&conversation.id))throw new Error('invalid');
      end=parsed.e;
    }catch(_){const error=new Error('Invalid or expired message cursor');error.code='INVALID_CURSOR';throw error}
  }
  const start=Math.max(0,end-limit),page=messages.slice(start,end);
  return {messages:page,total:messages.length,nextCursor:start>0?Buffer.from(JSON.stringify({e:start,i:String(conversation&&conversation.id)})).toString('base64url'):null,limit};
}

module.exports={DEFAULT_LIMIT,MAX_LIMIT,conversationActivity,conversationSummary,conversationContactKey,paginateConversations,paginateMessages};
