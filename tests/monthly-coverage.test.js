const test=require('node:test'),assert=require('node:assert/strict');
const {estimateMonthlyMinutes}=require('../public-experience');
test('monthly coverage uses the chosen volume without weekly conversion or silent clamping',()=>{
 assert.equal(estimateMonthlyMinutes(100,3),300);assert.equal(estimateMonthlyMinutes(200,3),600);assert.equal(estimateMonthlyMinutes(1000,8),8000);assert.equal(estimateMonthlyMinutes(0,2),0);assert.equal(estimateMonthlyMinutes(37,1.5),56);
 for(const args of [[-1,3],[100,0],[NaN,3],[100,Infinity]])assert.equal(estimateMonthlyMinutes(...args),null);
});
