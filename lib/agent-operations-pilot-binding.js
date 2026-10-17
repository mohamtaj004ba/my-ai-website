'use strict';
// Dashboard snapshots are selection bindings, never execution authority.
function binding(a,runtime){return{approvalHash:require('./agent-operations-organization-qa').hash(a),id:a.id,workflowId:a.workflowId,contractHash:a.contractHash,sourceCommit:a.sourceCommit,deploymentOrigin:runtime.origin};}
function matches(input,a,runtime){return !!(a&&runtime&&input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===6&&Object.entries(binding(a,runtime)).every(([k,v])=>typeof v==='string'&&Object.hasOwn(input,k)&&input[k]===v));}
module.exports={binding,matches};
