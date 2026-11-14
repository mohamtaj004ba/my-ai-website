'use strict';
function score(cases,predictions){
 const visual=cases.filter(c=>c.gold.support!=='integrity');if(predictions.length!==visual.length||new Set(predictions.map(p=>p.id)).size!==visual.length)throw Error('Evaluation coverage mismatch');
 const r={supported:0,rejectable:0,insufficient:0,falseApprovals:0,falseRejections:0,uncertaintyErrors:0,brier:0,ece:0},bins=[[],[],[]];
 for(const c of visual){const p=predictions.find(p=>p.id===c.id);if(!p||!['accept','reject'].includes(p.decision)||!['supported','contradicted','insufficient'].includes(p.support)||!Number.isFinite(p.probability)||p.probability<0||p.probability>1)throw Error('Invalid evaluation decision');const y=c.gold.support==='supported'?1:0;r.supported+=y;r.rejectable+=1-y;if(!y&&p.decision==='accept')r.falseApprovals++;if(y&&p.decision==='reject')r.falseRejections++;if(c.gold.support==='insufficient'){r.insufficient++;if(p.support!=='insufficient'||p.decision!=='reject')r.uncertaintyErrors++;}r.brier+=(p.probability-y)**2;bins[Math.min(2,Math.floor(p.probability*3))].push({p:p.probability,y});}
 r.falseApprovalRate=r.rejectable?r.falseApprovals/r.rejectable:null;r.falseRejectionRate=r.supported?r.falseRejections/r.supported:null;r.brier=visual.length?r.brier/visual.length:null;r.ece=visual.length?bins.reduce((s,b)=>s+(b.length?b.length/visual.length*Math.abs(b.reduce((n,x)=>n+x.p-x.y,0)/b.length):0),0):null;r.binCounts=bins.map(b=>b.length);r.seedGatePassed=r.falseApprovals===0&&r.falseRejections<=1&&r.uncertaintyErrors===0&&r.brier!==null&&r.brier<=.15&&r.ece<=.1;return r;
}
module.exports={score};
