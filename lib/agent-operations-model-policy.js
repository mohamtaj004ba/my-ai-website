'use strict';
const SOL='gpt-6.1-sol',LEGACY='gpt-4.1-2025-04-14';
const PREFERENCES=Object.freeze({'chief-of-staff':Object.freeze({model:SOL,reasoningEffort:'medium',fallback:LEGACY}),'independent-qa':Object.freeze({model:SOL,reasoningEffort:'medium',fallback:null}),'website-visual-qa':Object.freeze({model:LEGACY,reasoningEffort:null,fallback:null})});
function select({role,purpose='standard',difficulty='routine',consequence='low',fallbackExplicitlySelected=false}={}){
 const preferred=PREFERENCES[role];if(!preferred||!['standard','simple-coordination','controlled-comparison'].includes(purpose)||!['routine','complex'].includes(difficulty)||!['low','high'].includes(consequence))throw Error('Model selection denied');
 if(fallbackExplicitlySelected&&(role!=='chief-of-staff'||!['simple-coordination','controlled-comparison'].includes(purpose)||difficulty!=='routine'||consequence!=='low'))throw Error('Fallback outside approved purpose');
 return{model:fallbackExplicitlySelected?LEGACY:preferred.model,reasoningEffort:fallbackExplicitlySelected?null:preferred.reasoningEffort,requiresEscalationApproval:consequence==='high',automaticFallback:false,automaticPaidRetry:false,executionAuthorized:false};
}
module.exports={PREFERENCES,select,SOL,LEGACY};
