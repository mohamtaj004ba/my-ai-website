'use strict';
const PROJECT=Object.freeze({projectId:'proj_yXcOqJDtCRl2chdkRYAJ6VvH',organizationId:'org-0Q2ER0RtAeROLY3fYSuMn5CX'});
const matchesProject=v=>!!v&&v.projectId===PROJECT.projectId&&v.organizationId===PROJECT.organizationId;
function workerCredential(env){
  if(!matchesProject({projectId:env.CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID,organizationId:env.CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID})||!env.CALLERCORE_AGENTOPS_OPENAI_API_KEY)throw new Error('Dedicated Agent Operations credential configuration required');
  return env.CALLERCORE_AGENTOPS_OPENAI_API_KEY;
}
module.exports={PROJECT,matchesProject,workerCredential};
