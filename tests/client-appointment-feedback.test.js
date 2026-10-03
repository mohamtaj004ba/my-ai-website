const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const js=fs.readFileSync(path.join(root,'dashboard.js'),'utf8');

test('appointment status updates use inline live feedback instead of browser alerts',()=>{
  assert.match(html,/id="appointmentActionStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(js,/function setAppointmentActionStatus\(message='',tone=''\)/);
  assert.match(js,/setAppointmentActionStatus\('Updating appointment…'\)/);
  assert.match(js,/setAppointmentActionStatus\('Appointment updated\.',\s*'success'\)/);
  const block=js.match(/async function updateAppointment\(id,status\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.ok(block,'updateAppointment block should be present');
  assert.doesNotMatch(block,/\b(?:window\.)?alert\s*\(/);
  assert.match(block,/setAppointmentActionStatus\(err\.message\|\|'Could not update appointment\. Check your connection and try again\.',\s*'error'\)/);
});
