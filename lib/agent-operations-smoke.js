'use strict';
// Fixed internal Preview task, never a client-supplied prompt or tool profile.
const SMOKE=Object.freeze({profile:'chief-smoke',calls:1,maxMicros:300000,outputTokens:128,requestTimeoutMs:90000,
  objective:'Confirm this single Chief API invocation. No other work.',
  instructions:'You are CallerCore Chief of Staff performing an authentication and response-format smoke test. Return only the JSON object {"stage":"chief","note":"SMOKE_OK"}. Do not delegate, inspect websites, call tools or authorize actions.'});
const isSmoke=value=>value?.profile===SMOKE.profile;
const validSmokeResult=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&value.stage==='chief'&&value.note==='SMOKE_OK';
module.exports={SMOKE,isSmoke,validSmokeResult};
