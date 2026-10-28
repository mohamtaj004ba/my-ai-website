const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('scheduled analytics maintenance is disabled by default and secret-gated before writes',()=>{
  const api=fs.readFileSync('api/analytics-maintenance.js','utf8'),vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.match(api,/CALLERCORE_MAINTENANCE_ENABLED!=='true'/);
  assert.match(api,/CRON_SECRET/);
  assert.match(api,/timingSafeEqual/);
  assert.match(api,/refreshMonthlyKpiSnapshot/);
  assert.match(api,/finalizePreviousMonthlyKpi/);
  assert.doesNotMatch(api,/applySessionIndexCompaction/);
  const cron=(vercel.crons||[]).find(x=>x.path==='/api/analytics-maintenance');
  assert.ok(cron);
  assert.equal(cron.schedule,'17 5 * * *');
});
