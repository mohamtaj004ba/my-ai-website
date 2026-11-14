import assert from 'node:assert/strict';
// Trusted product functions, fictional page-memory rows; no API or persistence.
export async function verifyDashboardCalendar({page}){
 const session=await page.context().newCDPSession(page),zone=await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone);const checks=[];
 try{await session.send('Emulation.setTimezoneOverride',{timezoneId:'America/Los_Angeles'});
 for(const scenario of [
 {name:'spring',now:'2026-03-10T12:00:00',at:['2026-03-08T00:00:00','2026-03-08T23:59:59','2026-03-09T00:00:00','2026-03-09T00:30:00'],expected:[2,2,0]},
 {name:'fall',now:'2026-11-03T12:00:00',at:['2026-11-01T01:30:00-07:00','2026-11-01T01:30:00-08:00','2026-11-01T23:59:59','2026-11-02T00:00:00'],expected:[3,1,0]}]){
 const result=await page.evaluate(s=>{const OriginalDate=Date,originalRows=callsData,originalDays=overviewChartDays,range=document.getElementById('insightsRange'),originalRange=range.value;const frozen=+new OriginalDate(s.now);try{window.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[frozen]));}static now(){return frozen;}};callsData=s.at.map((at,i)=>({id:'qa-calendar-memory-'+i,at:+new OriginalDate(at),status:'completed',duration:30}));overviewChartDays=3;range.value='7';renderOverview();renderAnalytics();return{overview:[...document.querySelectorAll('#overviewLineChart .combo-hit')].map(el=>Number(el.getAttribute('aria-label').match(/: (\d+) total call/)[1])),analytics:[...document.querySelectorAll('#insightDailyBars .insight-bar-col>b')].map(el=>Number(el.textContent)).slice(-3),rolling:[withinDays(frozen-3*86400000,3),withinDays(frozen-3*86400000-1,3)]};}finally{window.Date=OriginalDate;callsData=originalRows;overviewChartDays=originalDays;range.value=originalRange;renderOverview();renderAnalytics();}},scenario);
 assert.deepEqual(result.overview,scenario.expected);assert.deepEqual(result.analytics,scenario.expected);assert.deepEqual(result.rolling,[true,false]);checks.push({scenario:scenario.name,bothActualChartDOM:true,counts:scenario.expected});
 }
 }finally{try{await session.send('Emulation.setTimezoneOverride',{timezoneId:zone});await page.evaluate(()=>{renderOverview();renderAnalytics();});}finally{await session.detach();}}
 return{qualification:'Chromium actual rendered chart DOM with fictional in-memory calls, pinned time and restored state; no customer/provider mutation.',checks};
}
