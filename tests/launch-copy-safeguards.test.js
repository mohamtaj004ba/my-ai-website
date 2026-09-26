const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const chat=fs.readFileSync(path.join(root,'api','chat.js'),'utf8');
const dashboard=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');

test('public launch copy does not promise unlaunched SMS or calendar booking',()=>{
  assert.doesNotMatch(index,/books appointments/i);
  assert.doesNotMatch(index,/appointment scheduling/i);
  assert.doesNotMatch(chat,/automatic follow-up text the moment the call ends/i);
  assert.doesNotMatch(chat,/appointment booking, SMS marketing/i);
  assert.doesNotMatch(chat,/unlimited minutes/i);
  assert.match(chat,/Do not promise SMS, calendar booking, or any integration unless it is explicitly enabled/);
});

test('admin deletion copy reflects recoverable deletion instead of immediate destruction',()=>{
  assert.match(dashboard,/30-day recovery period/);
  assert.doesNotMatch(dashboard,/This permanently removes its CallerCore workspace data\. This cannot be undone/);
});

test('checkout and onboarding copy avoid unresolved scheduling and unlimited usage claims',()=>{
  const getStarted=fs.readFileSync(path.join(root,'get-started.html'),'utf8');
  const onboardingChat=fs.readFileSync(path.join(root,'api','onboarding-chat.js'),'utf8');
  const liveDemo=fs.readFileSync(path.join(root,'live-demo.html'),'utf8');
  const privacy=fs.readFileSync(path.join(root,'privacy.html'),'utf8');
  const terms=fs.readFileSync(path.join(root,'terms.html'),'utf8');
  assert.doesNotMatch(getStarted,/scheduling and qualification/i);
  assert.doesNotMatch(getStarted,/unlimited minutes/i);
  assert.doesNotMatch(onboardingChat,/appointment booking|SMS campaigns|unlimited minutes/i);
  assert.doesNotMatch(liveDemo,/scheduling requests/i);
  assert.doesNotMatch(privacy,/scheduling appointments/i);
  assert.doesNotMatch(terms,/appointment scheduling/i);
});

test('authenticated launch dashboard keeps deferred SMS and calendar capabilities off',()=>{
  const plans=fs.readFileSync(path.join(root,'lib','plans.js'),'utf8');
  const account=fs.readFileSync(path.join(root,'api','account.js'),'utf8');
  const dashHtml=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
  const dashJs=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');
  assert.match(plans,/CALLERCORE_CALENDAR_ENABLED==='true'/);
  assert.match(plans,/CALLERCORE_SMS_ENABLED==='true'/);
  assert.match(account,/Calendar automation triggers are not enabled/);
  assert.match(account,/SMS automation actions are not enabled/);
  assert.match(account,/CALLERCORE_SMS_ENABLED==='true'&&saved\.smsAlerts!==false/);
  assert.match(account,/CALLERCORE_CALENDAR_ENABLED==='true'&&!!saved\.googleCalendar/);
  assert.doesNotMatch(dashHtml,/>Send SMS</);
  assert.doesNotMatch(dashHtml,/value="appointment_booked"/);
  assert.doesNotMatch(dashHtml,/value="send_confirmation"/);
  assert.match(dashHtml,/SMS alerts · coming later/);
  assert.match(dashHtml,/Google Calendar<\/b><p>Calendar booking is planned for a later release/);
  assert.doesNotMatch(dashJs,/Unlimited minutes|unlimited plan/i);
});

test('onboarding assistant does not promise recording transcription or automatic SMS',()=>{
  const onboardingChat=fs.readFileSync(path.join(root,'api','onboarding-chat.js'),'utf8');
  assert.doesNotMatch(onboardingChat,/all calls recorded and transcribed/i);
  assert.doesNotMatch(onboardingChat,/Every call is recorded and transcribed/i);
  assert.doesNotMatch(onboardingChat,/automatic follow-up text the moment the call ends/i);
  assert.match(onboardingChat,/Do not promise SMS, calendar booking, recording, transcription/);
});

test('signed agreement template does not restore unresolved Pro unlimited terms',()=>{
  const clauses=fs.readFileSync(path.join(root,'api','_lib','agreement-clauses.js'),'utf8');
  assert.match(clauses,/AGREEMENT_VERSION = '2\.1'/);
  const current=clauses.slice(clauses.indexOf('const CLAUSES ='));
  assert.doesNotMatch(current,/includedMinutes:'Unlimited'/i);
  assert.doesNotMatch(current,/\$0\.30 per minute/i);
});
