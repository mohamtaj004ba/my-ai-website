'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const app=require('../lib/agent-operations-github-app');
test('App boundary rejection codes remain finite and actionable in durable audit',()=>{
 for(const code of ['GH_CONFIGURATION_REQUIRED','GH_APP_ID_INVALID','GH_PROVIDER_DENIED','GH_RESPONSE_BOUNDS','GH_REQUEST_DENIED','GH_OPERATION_DISABLED','GH_TRUSTED_DEPENDENCY_REQUIRED','GH_CANCELLED','GH_TIMEOUT','GH_AUTHORITY_DENIED','GH_CREDENTIAL_SCOPE_DENIED','GH_REPOSITORY_SCOPE_DENIED','GH_RESPONSE_INVALID','GH_TRANSPORT_OR_CONTRACT_UNAVAILABLE'])assert.equal(app.failureCode(Error(code)),'INT_GITHUB_APP_'+code.slice(3));
 for(const code of ['GH_TIMEOUT\nsecret','GH_UNKNOWN_SECRET','INT_GITHUB_APP_SECRET','ghs_private','INT_GITHUB_UNKNOWN'])assert.equal(app.failureCode(Error(code)),'INT_READ_UNCONFIRMED');
 assert.equal(app.failureCode(Object.assign(Error('secret'),{diagnostic:'GH_TIMEOUT'})),'INT_READ_UNCONFIRMED');
 assert.equal(app.failureCode(Error('INT_GITHUB_KEY_INVALID')),'INT_GITHUB_KEY_INVALID');
});
