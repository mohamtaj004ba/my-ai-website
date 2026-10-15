# Owner-reviewable dashboard calendar proposal

Status: inert proposed correction; NOT applied, executed, approved or published to the product. CallerCore internal agents have no publication authority. Work prepared the proposal; the internal orchestration is deterministic, not new live-model reasoning.

Exact file: dashboard.js. Verified preimage SHA256: 441484e8a28273bb17eb0c1533b306935c30e00526a5cfc68a8e75b011fad5a6. Expected proposed output: d0e084ec5a3926f0c306c65a1e94f15ff2d93af286023fdf7821b564018e9466. Diff SHA256: 1b980d3ab19d0bfb69b0fbd56ab13cf3500045cfbebde0485fcaeb231cb74c4c. The same product bytes are curated in application2efd4a00875f2d707bdc3e4a8dc62c22aecb9ee3; independent evidence retains its original source checkpoint.

This changes both Overview and Analytics to derive start/end from one captured calendar reference. It preserves rolling-duration filters, other KPIs and tomorrow-button behavior. Independent read-only applicability and syntax checks passed; proposed code was never executed. Calendar arithmetic uses independently authored trusted reference tests, not a claim of patched browser behavior. Full/fractional/midnight DST boundaries are covered. Entirely skipped civil dates can yield an empty bucket and duplicated normalized label; actual customer occurrence and rendered acceptance remain unverified.

A separate reviewed and owner-authorized application step plus relevant runtime/browser verification is still required. Internal publication, paid inference and Production access remain disabled.

```diff
diff --git a/dashboard.js b/dashboard.js
index 57ac67a..1801607 100644
--- a/dashboard.js
+++ b/dashboard.js
@@ -574,6 +574,7 @@ function recordTime(x){
   const d=Date.parse([x?.date,x?.time].filter(Boolean).join(' '));return Number.isFinite(d)?d:0;
 }
 function sameLocalDay(ts,date=new Date()){const d=new Date(ts);return d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()&&d.getDate()===date.getDate()}
+function localDayBoundary(date,offset){return new Date(date.getFullYear(),date.getMonth(),date.getDate()+offset)}
 function withinDays(ts,days){return !!ts&&ts>=Date.now()-days*86400000}
 function formatFullDateTime(x){
   const ts=recordTime(x);if(ts)return new Date(ts).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
@@ -614,9 +615,9 @@ function renderOverview(){
 
   const chart=document.getElementById('overviewLineChart');
   if(chart){
-    const days=[];
+    const days=[],chartToday=new Date();
     for(let i=overviewChartDays-1;i>=0;i--){
-      const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=d.getTime()+86400000;
+      const d=localDayBoundary(chartToday,-i),next=localDayBoundary(chartToday,1-i).getTime();
       const dayCalls=callsData.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}),needs=dayCalls.filter(teamStatusActive).length,resolved=dayCalls.filter(callResolvedByAi).length,captured=dayCalls.filter(callCaptured).length;
       days.push({date:callLocalDateValue(d.getTime()),label:d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}),short:d.toLocaleDateString(undefined,overviewChartDays>14?{month:'numeric',day:'numeric'}:{weekday:'short'}),n:dayCalls.length,needs,resolved,captured});
     }
@@ -1565,7 +1566,7 @@ function renderAnalytics(){
   const days=Number(document.getElementById('insightsRange')?.value||30),rows=callsData.filter(x=>withinDays(recordTime(x),days)),total=rows.length,answered=rows.filter(callAnswered).length,resolved=rows.filter(callResolvedByAi).length,afterHours=rows.filter(x=>{const h=new Date(recordTime(x)).getHours();return h<8||h>=18}).length,activeDays=new Set(rows.map(x=>new Date(recordTime(x)).toDateString())).size,avg=activeDays?Math.round(total/activeDays*10)/10:0;
   const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};set('analyticsAnswerRate',(total?Math.round(answered/total*100):0)+'%');set('analyticsQualified',(total?Math.round(resolved/total*100):0)+'%');set('analyticsAfterHours',(total?Math.round(afterHours/total*100):0)+'%');set('analyticsDailyAvg',avg);set('analyticsCalls',total+' total calls');
   const reasons={};rows.forEach(x=>{const k=String(x.category||'Other');reasons[k]=(reasons[k]||0)+1});const reasonRows=Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,9),reasonMax=Math.max(1,...reasonRows.map(x=>x[1])),reasonWrap=document.getElementById('callReasonBars');if(reasonWrap)reasonWrap.innerHTML=reasonRows.map(([label,value])=>'<div class="bar-row"><span>'+esc(label)+'</span><b>'+Math.round(value/Math.max(1,total)*100)+'%</b><div class="bar-track"><i style="width:'+Math.round(value/reasonMax*100)+'%"></i></div></div>').join('')||'<span class="muted">No call data yet.</span>';
-  const daily=document.getElementById('insightDailyBars');if(daily){const vals=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const next=d.getTime()+86400000,n=rows.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}).length;vals.push({d,n})}const display=vals.filter((_,i)=>days<=7||i%Math.max(1,Math.floor(days/12))===0||i===vals.length-1),max=Math.max(1,...display.map(x=>x.n));daily.innerHTML=display.map(x=>'<div class="insight-bar-col"><b>'+x.n+'</b><span><i style="height:'+Math.max(5,Math.round(x.n/max*100))+'%"></i></span><small>'+x.d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</small></div>').join('')}
+  const daily=document.getElementById('insightDailyBars');if(daily){const vals=[],chartToday=new Date();for(let i=days-1;i>=0;i--){const d=localDayBoundary(chartToday,-i),next=localDayBoundary(chartToday,1-i).getTime(),n=rows.filter(x=>{const t=recordTime(x);return t>=d.getTime()&&t<next}).length;vals.push({d,n})}const display=vals.filter((_,i)=>days<=7||i%Math.max(1,Math.floor(days/12))===0||i===vals.length-1),max=Math.max(1,...display.map(x=>x.n));daily.innerHTML=display.map(x=>'<div class="insight-bar-col"><b>'+x.n+'</b><span><i style="height:'+Math.max(5,Math.round(x.n/max*100))+'%"></i></span><small>'+x.d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</small></div>').join('')}
   const hours=Array.from({length:12},(_,i)=>({h:i+7,n:0}));rows.forEach(x=>{const h=new Date(recordTime(x)).getHours(),slot=hours.find(v=>v.h===h);if(slot)slot.n++});const hourWrap=document.getElementById('insightHourBars');if(hourWrap){const max=Math.max(1,...hours.map(x=>x.n));hourWrap.innerHTML=hours.map(x=>'<div><small>'+new Date(2020,1,1,x.h).toLocaleTimeString(undefined,{hour:'numeric'})+'</small><span><i style="width:'+Math.round(x.n/max*100)+'%"></i></span><b>'+x.n+'</b></div>').join('')}
   const outcomes={};rows.forEach(x=>{const k=callDispositionLabel(x);outcomes[k]=(outcomes[k]||0)+1});const donut=document.getElementById('outcomeDonut'),legend=document.getElementById('outcomeLegend'),colors=['#4f9b6a','#5f7f9a','#d88736','#c65d4a','#87919b','#8b78a8','#5f6b73'];if(donut){let cursor=0,parts=Object.values(outcomes).map((v,i)=>{const pct=total?(v/total*100):0,start=cursor;cursor+=pct;return colors[i%colors.length]+' '+start+'% '+cursor+'%'});donut.style.background='conic-gradient('+(parts.join(',')||'#e8ebee 0 100%')+')';set('outcomeDonutLabel',total)}if(legend)legend.innerHTML=Object.entries(outcomes).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>'<div><span><i style="background:'+colors[i%colors.length]+'"></i>'+esc(k)+'</span><b>'+v+' · '+(total?Math.round(v/total*100):0)+'%</b></div>').join('');
 }
```
