const test=require('node:test'),assert=require('node:assert/strict');
const {estimateMonthlyMinutes,recommendPlan}=require('../public-experience');
test('recommendations change at included-minute boundaries without inventing Pro capacity',()=>{
 for(const [minutes,name] of [[30,'Starter'],[300,'Starter'],[301,'Growth'],[600,'Growth'],[601,'Pro'],[8000,'Pro']])assert.equal(recommendPlan(minutes).name,name);
 assert.match(recommendPlan(601).reason,/Confirm the included allowance/);
 for(const bad of [-1,NaN,Infinity,'300'])assert.equal(recommendPlan(bad),null);
 assert.equal(estimateMonthlyMinutes(100,3),300);assert.equal(estimateMonthlyMinutes(1000,8),8000);
});
