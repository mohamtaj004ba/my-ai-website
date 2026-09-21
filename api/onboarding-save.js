const { kv } = require('@vercel/kv');
const { buildAgreementPdfBytes } = require('./_lib/agreement-pdf');
const { sendMail } = require('./_lib/mailgun');
const { syncCompletedOnboarding } = require('../lib/onboarding-sync');
const { AGREEMENT_VERSION, AGREEMENT_EFFECTIVE_DATE, agreementSnapshot, planSnapshot } = require('./_lib/agreement-clauses');

const ALLOWED_INTAKE_FIELDS = new Set([
  'website','businessName','contactName','phone','email','industry','industryOther','address','addressSharing','serviceArea','outOfArea','outOfAreaReferral',
  'tradeType','tradeTypeOther','servicesOffered','servicesNotOffered','gasUtility','insuranceInfo','vetAskSpecies','vetEmergencyNotes','conflictCheck',
  'realEstateNotes','vendorDispatch','salonNotes','collectVehicleInfo','hours','exampleRoutine','promiseRoutine','exampleUrgent','promiseUrgent',
  'exampleEmergency','promiseEmergency','routingChoice','forwardNumber','phoneCarrier','callHandling','notificationPreference','notifyRecipient',
  'notifyOtherName','notifyOtherTitle','notifyOtherPhone','notifyOtherEmail','escalationName','escalationPhone','escalationBackupName',
  'escalationBackupPhone','greeting','tone','faqs','pricingPolicy','pricingRanges','guardrails','additionalNotes','attribution'
]);
function validToken(token){return typeof token==='string'&&/^[a-f0-9]{48}$/i.test(token)}
function cleanText(v,max=6000){return typeof v==='string'?v.trim().slice(0,max):''}
function sanitizeFields(fields){
  if(!fields||typeof fields!=='object'||Array.isArray(fields)) return {};
  const out={};
  for(const [key,value] of Object.entries(fields)){
    if(ALLOWED_INTAKE_FIELDS.has(key)) out[key]=cleanText(value);
  }
  return out;
}
function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

// Handles two kinds of saves from the onboarding page:
//   { token, type: 'intake', fields: {...} }        -> merges into intake progress
//   { token, type: 'agreement', fullName: '...' }   -> records agreement signature
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, type, fields, fullName, finalize } = req.body || {};
  if (!validToken(token)) return res.status(400).json({ error: 'Invalid token' });

  const key = `onboarding:${token}`;
  const record = await kv.get(key);
  if (!record) return res.status(404).json({ error: 'not_found' });

  if (type === 'agreement') {
    const signedName=cleanText(fullName,120);
    if (!signedName) return res.status(400).json({ error: 'Missing fullName' });
    if(record.agreementSigned) return res.status(200).json({ok:true,status:record.status,alreadySigned:true});
    record.agreementSigned = true;
    record.agreementSignedAt = Date.now();
    record.agreementFullName = signedName;
    record.agreementVersion = AGREEMENT_VERSION;
    record.agreementEffectiveDate = AGREEMENT_EFFECTIVE_DATE;
    record.agreementSnapshot = agreementSnapshot();
    record.agreementPlanSnapshot = planSnapshot(record.plan);
    if(record.status==='awaiting_agreement')record.status='intake_in_progress';

    await kv.set(key, record, { ex: 60 * 60 * 24 * 90 });
    if(record.workspaceId){
      await kv.set('onboarding:workspace-token:'+record.workspaceId,token,{ex:60*60*24*90});
      const prior=await kv.get('onboarding:workspace:'+record.workspaceId)||{};
      await kv.set('onboarding:workspace:'+record.workspaceId,{...prior,workspaceId:record.workspaceId,status:'intake_in_progress',completionPercent:Number(record.completionPercent||0),agreementVersion:record.agreementVersion,agreementSignedAt:record.agreementSignedAt,agreementSignedName:record.agreementFullName,checklist:{...(prior.checklist||{}),payment:true,agreement:true,intake:false},updatedAt:Date.now()});
    }

    // Email a signed copy. Don't fail the request if this errors — the
    // client can still download the PDF on demand from /api/agreement-pdf.
    try {
      const signedDate = new Date(record.agreementSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const pdfBytes = await buildAgreementPdfBytes({
        business: record.business, fullName: signedName, plan: record.plan, signedAt: signedDate,
        clauses: record.agreementSnapshot.clauses, agreementVersion: record.agreementVersion, effectiveDate: record.agreementEffectiveDate, planSnapshot: record.agreementPlanSnapshot,
      });
      await sendMail({
        to: record.email,
        subject: 'Your signed CallerCore service agreement',
        text: `Hi ${signedName.split(' ')[0] || 'there'},\n\nAttached is your signed CallerCore service agreement for your records.\n\nQuestions any time: support@callercore.com\n\n\u2014 CallerCore`,
        html: `<p>Attached is your signed CallerCore service agreement for your records.</p><p>Questions any time: support@callercore.com</p>`,
        attachments: [{ filename: 'CallerCore-Service-Agreement.pdf', data: Buffer.from(pdfBytes), contentType: 'application/pdf' }],
      });
    } catch (err) {
      console.error('Failed to email signed agreement PDF:', err);
    }

    return res.status(200).json({ ok: true, status: record.status });
  } else if (type === 'intake') {
    const incoming=sanitizeFields(fields);
    if(!Object.keys(incoming).length) return res.status(400).json({error:'No valid fields'});
    record.intake = { ...(record.intake || {}), ...incoming };
    // If every required intake field is present, mark it submitted and
    // flip status so the completion notification and build workflow can pick it up.
    // Mirrors the conditional logic in onboarding.html's requiredFieldsForStep().
    const required = [
      'businessName', 'contactName', 'phone', 'email', 'industry', 'address', 'addressSharing', 'serviceArea', 'outOfArea',
      'servicesOffered', 'servicesNotOffered', 'hours',
      'exampleRoutine', 'promiseRoutine',
      'exampleUrgent', 'promiseUrgent',
      'exampleEmergency', 'promiseEmergency',
      'routingChoice', 'callHandling', 'notificationPreference', 'notifyRecipient',
      'escalationName', 'escalationPhone',
      'pricingPolicy',
    ];
    if (record.intake.notifyRecipient === 'Someone else on my team' || record.intake.notifyRecipient === 'Me and someone else') {
      required.push('notifyOtherName', 'notifyOtherTitle', 'notifyOtherPhone', 'notifyOtherEmail');
    }
    if (record.intake.industry === 'Other') {
      required.push('industryOther');
    }
    if (record.intake.outOfArea === 'Refer them elsewhere (tell us who below)') {
      required.push('outOfAreaReferral');
    }
    if (record.intake.industry === 'Trades & Construction (plumbing, HVAC, electrical, construction, roofing, etc.)') {
      required.push('tradeType');
      if (record.intake.tradeType === 'Plumbing' || record.intake.tradeType === 'HVAC') {
        required.push('gasUtility');
      }
      if (record.intake.tradeType === 'Other trade') {
        required.push('tradeTypeOther');
      }
    }
    if (record.intake.routingChoice === 'Forward existing number') {
      required.push('forwardNumber');
    }
    if (record.intake.pricingPolicy === 'Yes, give price ranges') {
      required.push('pricingRanges');
    }
    const complete = required.every((k) => record.intake[k] && String(record.intake[k]).trim() !== '');
    const completionPercent=Math.round((required.filter(k=>record.intake[k]&&String(record.intake[k]).trim()!=='').length/Math.max(1,required.length))*100);
    record.completionPercent=completionPercent;
    if(record.status==='awaiting_agreement'&&record.agreementSigned)record.status='intake_in_progress';
    const wantsFinalize=finalize===true;
    if(wantsFinalize&&!complete)return res.status(400).json({error:'Please complete all required onboarding fields before submitting.',completionPercent});
    const justCompleted = wantsFinalize && complete && record.status !== 'intake_complete';
    if (justCompleted) {
      record.status = 'intake_complete';
      record.intakeCompletedAt = Date.now();
    }

    await kv.set(key, record, { ex: 60 * 60 * 24 * 90 });
    if(record.workspaceId){
      await kv.set('onboarding:workspace-token:'+record.workspaceId,token,{ex:60*60*24*90});
      if(!justCompleted){
        const prior=await kv.get('onboarding:workspace:'+record.workspaceId)||{};
        await kv.set('onboarding:workspace:'+record.workspaceId,{...prior,workspaceId:record.workspaceId,status:record.status||'intake_in_progress',completionPercent,checklist:{...(prior.checklist||{}),payment:true,agreement:!!record.agreementSigned,intake:false},updatedAt:Date.now()});
      }
    }

    if (justCompleted) {
      const i = record.intake || {};
      const trade = i.tradeType ? `${i.industry} / ${i.tradeType}` : i.industry;

      // Send the completed intake directly to CallerCore operations.
      // Includes every field the form collected — not a curated subset — plus a
      // formatted PDF attachment for build reference and permanent company records.
      try {
        const submittedAt = new Date(record.intakeCompletedAt).toLocaleString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });

        const { SECTIONS, buildIntakeSummaryPdf } = require('./_lib/intake-summary-pdf');
        const textLines = [];
        const htmlLines = [];
        SECTIONS.forEach(([sectionTitle, fields]) => {
          const present = fields.filter(([key]) => i[key] && String(i[key]).trim() !== '');
          if (!present.length) return;
          textLines.push(`\n${sectionTitle.toUpperCase()}`);
          htmlLines.push(`<p style="margin:14px 0 4px;"><b>${sectionTitle}</b></p>`);
          present.forEach(([key, label]) => {
            textLines.push(`${label}: ${i[key]}`);
            htmlLines.push(`<div><span style="color:#666;">${escapeHtml(label)}:</span> ${escapeHtml(i[key])}</div>`);
          });
        });

        const { buildIntakeSummaryPdf: buildPdf } = { buildIntakeSummaryPdf };
        const pdfBytes = await buildPdf({
          business: i.businessName || record.business,
          contactName: i.contactName,
          plan: record.plan,
          intake: i,
          submittedAt,
        });

        await sendMail({
          to: 'tj@callercore.com',
          subject: `Intake complete — ${i.businessName || record.business || 'new client'} (build clock started)`,
          text: `Intake form submitted. The 1-business-day build clock starts now.\nFull intake attached as a PDF for your records.\n${textLines.join('\n')}\n\n— CallerCore onboarding`,
          html: `<p><b>Intake form submitted.</b> The 1-business-day build clock starts now. Full intake attached as a PDF for your records.</p>${htmlLines.join('\n')}`,
          attachments: [{
            filename: `Intake-Summary-${(i.businessName || record.business || 'client').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
            data: Buffer.from(pdfBytes),
            contentType: 'application/pdf',
          }],
        });
      } catch (err) {
        console.error('Internal intake_complete email failed:', err);
      }
      try{
        await syncCompletedOnboarding(record);
      }catch(err){
        console.error('Smart onboarding workspace sync failed:',err);
        record.syncError=String(err&&err.message||'sync_failed').slice(0,300);
        await kv.set(key,record,{ex:60*60*24*90});
      }
    }

    return res.status(200).json({ ok: true, status: record.status, completionPercent:record.completionPercent||0 });
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }
};
