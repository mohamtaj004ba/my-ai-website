'use strict';
// Synthetic assertions are confined to mock execution and its independent acceptance assessor.
const {createHash}=require('node:crypto');
function images(executionId,scope,now){return [1440,390,1440,390].map((viewport,i)=>({id:'I'+(i+1),sha256:createHash('sha256').update('synthetic-image-'+i).digest('hex'),viewport,height:1000,capturedAt:now,executionId,sourceCommit:scope.commit,provenance:'mock-fixture'}));}
function execute(dto,{reject=false}={}){
 if(dto.mode!=='mock')throw Error('Synthetic executor cannot run paid work');
 if(dto.stage==='chief')return{stage:'chief',delegate:'website-visual-qa',note:'Delegate the pinned read-only inspection.'};
 if(dto.stage==='inspect')return{stage:'inspect',findings:[{code:'BADGE_VISIBLE',imageId:'I3',note:reject?'The badge overlaps the price.':'A badge is visible in the pricing image.'}],artifacts:dto.capture.images,geometry:dto.capture.geometry,note:'Synthetic fixture, no browser or provider request.'};
 if(dto.stage==='observe')return{stage:'observe',facts:dto.evidence.images.map((a,i)=>({id:'O'+(i+1),imageId:a.id,region:[.1,.1,.9,.9],observed:i>=2?'A badge and separate price are visible.':'A dashboard illustration is visible.',readability:'clear',uncertainty:''})),note:'Independent synthetic observations.'};
 if(dto.stage==='adjudicate')return{stage:'adjudicate',findings:dto.claims.map(c=>({code:c.code,decision:reject?'reject':'accept',atoms:c.atoms.map(a=>({id:a.id,support:reject?'contradicted':'supported',probability:reject?.1:.99,reason:reject?'Measured price separation contradicts overlap.':'The observation identifies the visible badge.',observations:['O3'],evidence:[{imageId:'I3',region:[.2,.2,.8,.8]}],uncertainty:''}))})),note:'Evidence-linked synthetic assessment.'};
 if(dto.stage==='chief_review'){if(!dto.reportProjection)throw Error('Certified report input required');return structuredClone(dto.reportProjection);}
 throw Error('Undeclared mock stage');
}
module.exports={images,execute};
