'use strict';
function validRect(r){return r&&['x','y','width','height','right','bottom'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0&&Math.abs(r.right-r.x-r.width)<.01&&Math.abs(r.bottom-r.y-r.height)<.01;}
function relation(a,b){if(!validRect(a)||!validRect(b))return{status:'unknown'};const width=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x)),height=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));return{status:'measured',intersectionWidth:width,intersectionHeight:height,intersectionArea:width*height,overlapCandidate:width>1&&height>1,verticalGap:b.y-a.bottom,provenPaintedOcclusion:false};}
function reproduction(record,scope){
 if(record?.source!==scope?.commit||record.kind!=='OFFLINE replay geometry, not original capture-time DOM evidence'||!Array.isArray(record.results)||record.results.length!==2)return{status:'unknown',provenance:'unverified',originalCaptureGeometry:'unavailable'};
 const results=record.results.map(r=>({viewport:r.viewport,heading:relation(r.badge?.box,r.heading?.box),price:relation(r.badge?.box,r.price?.box),fontsLoaded:r.fontsLoaded===true}));
 if(results.some(r=>!r.fontsLoaded||![1440,390].includes(r.viewport?.width)||r.viewport?.height!==1000||r.heading.status!=='measured'||r.price.status!=='measured')||new Set(results.map(r=>r.viewport.width)).size!==2)return{status:'unknown',provenance:'unverified',originalCaptureGeometry:'unavailable'};
 return{status:'measured',provenance:'reproduction-only',originalCaptureGeometry:'unavailable',source:record.source,measuredAt:record.observedAt,browserVersion:record.browserVersion,results};
}
module.exports={validRect,relation,reproduction};
