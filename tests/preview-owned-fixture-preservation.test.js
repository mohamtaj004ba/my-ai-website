const test=require('node:test');
const assert=require('node:assert/strict');
const {replacePreviewWorkspaceIndex}=require('../lib/preview-workspace-seed');
const {replacePreviewPhoneSeed}=require('../lib/preview-phone-seed');
const {replacePreviewSupportSeed}=require('../lib/preview-support-seed');
const {replacePreviewFeedbackSeed}=require('../lib/preview-feedback-seed');

test('Preview reseeding retains human-owned fixture directory, phone, support and feedback',async()=>{
 const protectedWorkspaceIds=['seed_owned'];
 const map=new Map([
  ['workspace:index',['primary','seed_owned','seed_retired','real']],
  ['phone:index',[{id:'owned_phone',workspaceId:'seed_owned',providerId:'keep'},{id:'retired_phone',workspaceId:'seed_retired'}]],
  ['support:index',['seed_support_seed_owned','seed_support_seed_retired']],
  ['support:seed_support_seed_owned',{workspaceId:'seed_owned',message:'Keep my history'}],
  ['support:seed_support_seed_retired',{workspaceId:'seed_retired'}],
  ['ai-feedback:index',['seed_feedback_seed_owned','seed_feedback_seed_retired']],
  ['ai-feedback:seed_feedback_seed_owned',{workspaceId:'seed_owned',message:'Keep feedback'}],
  ['ai-feedback:seed_feedback_seed_retired',{workspaceId:'seed_retired'}]
 ]);
 const kv={get:async key=>map.get(key)??null,del:async key=>map.delete(key)};
 const compare=async(_,updates)=>{for(const u of updates)assert.deepEqual(map.get(u.key)??null,u.before);for(const u of updates)map.set(u.key,u.after);return true};
 const options={compare,protectedWorkspaceIds};
 await replacePreviewWorkspaceIndex(kv,'primary',['seed_new'],options);
 assert.deepEqual(map.get('workspace:index'),['primary','seed_new','seed_owned','real']);
 await replacePreviewPhoneSeed(kv,'primary',{id:'primary_phone',workspaceId:'primary'},[],options);
 assert.deepEqual(map.get('phone:index'),[{id:'primary_phone',workspaceId:'primary'},{id:'owned_phone',workspaceId:'seed_owned',providerId:'keep'}]);
 await replacePreviewSupportSeed(kv,[],options);
 assert.deepEqual(map.get('support:index'),['seed_support_seed_owned']);
 assert.equal(map.get('support:seed_support_seed_owned').message,'Keep my history');
 assert.equal(map.has('support:seed_support_seed_retired'),false);
 await replacePreviewFeedbackSeed(kv,[],options);
 assert.deepEqual(map.get('ai-feedback:index'),['seed_feedback_seed_owned']);
 assert.equal(map.get('ai-feedback:seed_feedback_seed_owned').message,'Keep feedback');
 assert.equal(map.has('ai-feedback:seed_feedback_seed_retired'),false);
});
