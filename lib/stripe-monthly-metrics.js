const crypto=require('crypto');
const {compareAndSetConfig}=require('./config-transaction');
const {monthKey}=require('./monthly-kpi-rollup');

const STRIPE_MONTHLY_METRICS_COVERAGE_KEY='stripe:monthly-metrics:coverage';
const STRIPE_METRIC_RECEIPT_SECONDS=2*365*24*60*60;
const RECORD_STRIPE_PAYMENT_FAILURE=`
local metricType=redis.call('TYPE',KEYS[1]).ok
if metricType~='none' and metricType~='string' then return -1 end
local receiptType=redis.call('TYPE',KEYS[2]).ok
if receiptType~='none' and receiptType~='string' then return -2 end
if redis.call('EXISTS',KEYS[2])==1 then return 0 end
local metric={month=ARGV[1],paymentFailures=0,updatedAt=0}
local raw=redis.call('GET',KEYS[1])
if raw then
  local ok,decoded=pcall(cjson.decode,raw)
  if not ok or type(decoded)~='table' or decoded.month~=ARGV[1] or type(decoded.paymentFailures)~='number' or decoded.paymentFailures<0 or decoded.paymentFailures%1~=0 then return -3 end
  metric=decoded
end
local updatedAt=tonumber(ARGV[2])
local ttl=tonumber(ARGV[3])
if not updatedAt or updatedAt<=0 or not ttl or ttl<86400 then return -4 end
metric.paymentFailures=metric.paymentFailures+1
metric.updatedAt=updatedAt
local ok,encoded=pcall(cjson.encode,metric)
if not ok then return -5 end
redis.call('SET',KEYS[1],encoded)
redis.call('SET',KEYS[2],'1','EX',ttl)
return 1
`;

function validTimestamp(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0}
function monthlyStripeMetricKey(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||'')))throw new Error('Stripe monthly metric month is invalid');return 'stripe:monthly-metrics:'+month}
function stripeMetricReceiptKey(eventId){
  const id=String(eventId||'').trim();if(!id||id.length>240)throw new Error('Stripe metric event id is invalid');
  return 'stripe:metric-event:'+crypto.createHash('sha256').update(id).digest('hex');
}
function validateCoverage(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!validTimestamp(value.startedAt))throw new Error('Stripe monthly metrics coverage marker is malformed');
  return {startedAt:Number(value.startedAt)};
}
function validateMonthlyMetric(value,month){
  if(value==null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||String(value.month||'')!==month||!Number.isInteger(Number(value.paymentFailures))||Number(value.paymentFailures)<0||!validTimestamp(value.updatedAt))
    throw new Error('Stripe monthly metric record is malformed');
  return {month,paymentFailures:Number(value.paymentFailures),updatedAt:Number(value.updatedAt)};
}

async function ensureStripeMonthlyMetricsCoverage(kv,now=Date.now(),{attempts=4}={}){
  if(!kv||typeof kv.get!=='function'||typeof kv.eval!=='function')throw new Error('Stripe monthly metric storage is unavailable');
  const startedAt=validTimestamp(now);if(!startedAt)throw new Error('Stripe monthly metrics coverage time is invalid');
  const max=Math.max(1,Math.min(6,Number(attempts)||4));
  for(let attempt=0;attempt<max;attempt++){
    const current=await kv.get(STRIPE_MONTHLY_METRICS_COVERAGE_KEY);
    if(current!=null)return validateCoverage(current);
    const next={startedAt};
    if(await compareAndSetConfig(kv,[{key:STRIPE_MONTHLY_METRICS_COVERAGE_KEY,before:null,after:next}]))return next;
  }
  const confirmed=await kv.get(STRIPE_MONTHLY_METRICS_COVERAGE_KEY);
  if(confirmed!=null)return validateCoverage(confirmed);
  throw new Error('Stripe monthly metrics coverage could not be initialized');
}

async function recordStripePaymentFailure(kv,event,{now=Date.now()}={}){
  if(!kv||typeof kv.eval!=='function')throw new Error('Stripe monthly metric storage is unavailable');
  const id=String(event?.id||'').trim(),createdSeconds=Number(event?.created),recordedAt=validTimestamp(now);
  if(!id||!Number.isFinite(createdSeconds)||createdSeconds<=0||!recordedAt)throw new Error('Stripe payment-failure metric event is invalid');
  await ensureStripeMonthlyMetricsCoverage(kv,recordedAt);
  const eventAt=createdSeconds*1000,month=monthKey(eventAt),metricKey=monthlyStripeMetricKey(month),receiptKey=stripeMetricReceiptKey(id);
  const result=Number(await kv.eval(RECORD_STRIPE_PAYMENT_FAILURE,[metricKey,receiptKey],[month,String(recordedAt),String(STRIPE_METRIC_RECEIPT_SECONDS)]));
  if(result===-1)throw new Error('Stripe monthly metric storage type is invalid');
  if(result===-2)throw new Error('Stripe metric receipt storage type is invalid');
  if(result===-3)throw new Error('Stripe monthly metric record is malformed');
  if(result===-4||result===-5||![0,1].includes(result))throw new Error('Stripe payment-failure metric transaction could not be confirmed');
  return {month,counted:result===1,duplicate:result===0};
}

async function readStripeMonthlyPaymentFailures(kv,month,monthStart){
  if(!kv||typeof kv.get!=='function')throw new Error('Stripe monthly metric storage is unavailable');
  const start=validTimestamp(monthStart);if(!start)throw new Error('Stripe monthly metric month boundary is invalid');
  const coverageRaw=await kv.get(STRIPE_MONTHLY_METRICS_COVERAGE_KEY);
  if(coverageRaw==null)return {complete:false,count:null,reason:'coverage_not_started',coverageStartedAt:null};
  const coverage=validateCoverage(coverageRaw);
  if(coverage.startedAt>start)return {complete:false,count:null,reason:'partial_month',coverageStartedAt:coverage.startedAt};
  const metric=validateMonthlyMetric(await kv.get(monthlyStripeMetricKey(month)),month);
  return {complete:true,count:metric?metric.paymentFailures:0,reason:'',coverageStartedAt:coverage.startedAt};
}

module.exports={
  STRIPE_MONTHLY_METRICS_COVERAGE_KEY,STRIPE_METRIC_RECEIPT_SECONDS,RECORD_STRIPE_PAYMENT_FAILURE,
  monthlyStripeMetricKey,stripeMetricReceiptKey,ensureStripeMonthlyMetricsCoverage,recordStripePaymentFailure,readStripeMonthlyPaymentFailures
};
