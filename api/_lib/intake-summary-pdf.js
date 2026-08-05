const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const LOGO_BASE64 = require('./logo-base64');

const INK      = rgb(0.12, 0.13, 0.16);
const MUTED    = rgb(0.45, 0.47, 0.51);
const HAIRLINE = rgb(0.85, 0.86, 0.88);
const SIGNAL   = rgb(0.824, 0.404, 0.235);
const NAVY     = rgb(0.047, 0.118, 0.220);
const PAPER    = rgb(1, 1, 1);

const PAGE_W = 612, PAGE_H = 792;
const MARGIN = 62;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BAND_H = 96;
const FOOTER_Y = 44;
const BOTTOM_LIMIT = 74;

// Every field the intake form can collect, grouped and labelled to match
// what's shown on the onboarding page itself. Fields not present on a given
// client's record (unused conditionals, skipped optionals) are omitted
// automatically rather than printed blank.
const SECTIONS = [
  ['Your Business', [
    ['businessName', 'Business name'],
    ['contactName', 'Contact name'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['industry', 'Industry'],
    ['industryOther', 'Industry (specified)'],
    ['address', 'Business address'],
    ['addressSharing', 'Can the AI share the address?'],
    ['serviceArea', 'Service area'],
    ['outOfArea', 'Out-of-area calls'],
    ['outOfAreaReferral', 'Referred to'],
  ]],
  ['Services & Hours', [
    ['tradeType', 'Trade'],
    ['tradeTypeOther', 'Trade (specified)'],
    ['servicesOffered', 'Services offered'],
    ['servicesNotOffered', 'Services NOT offered'],
    ['hours', 'Business hours'],
    ['gasUtility', 'Local gas utility'],
    ['insuranceInfo', 'Insurance/intake info (Medical & Dental)'],
    ['vetAskSpecies', 'Ask animal species? (Veterinary)'],
    ['vetEmergencyNotes', 'Emergency situations (Veterinary)'],
    ['conflictCheck', 'Conflict-of-interest check (Legal)'],
    ['realEstateNotes', 'Showing/inquiry notes (Real Estate)'],
    ['vendorDispatch', 'Vendor dispatch (Property Management)'],
    ['salonNotes', 'Booking notes (Salon & Personal Care)'],
    ['collectVehicleInfo', 'Collect vehicle info? (Automotive)'],
  ]],
  ['Call Handling & Urgency', [
    ['exampleRoutine', 'Example: ROUTINE call'],
    ['promiseRoutine', 'Follow-up promise: routine'],
    ['exampleUrgent', 'Example: URGENT call'],
    ['promiseUrgent', 'Follow-up promise: urgent'],
    ['exampleEmergency', 'Example: EMERGENCY call'],
    ['promiseEmergency', 'Follow-up promise: emergency'],
    ['routingChoice', 'Number routing'],
    ['forwardNumber', 'Number to forward'],
    ['phoneCarrier', 'Phone carrier'],
    ['callHandling', 'When the AI should answer'],
    ['notificationPreference', 'Lead notification method'],
    ['notifyRecipient', 'Notification recipient'],
    ['notifyOtherName', 'Recipient name'],
    ['notifyOtherTitle', 'Recipient title'],
    ['notifyOtherPhone', 'Recipient phone'],
    ['notifyOtherEmail', 'Recipient email'],
    ['escalationName', 'Emergency escalation contact'],
    ['escalationPhone', 'Escalation phone'],
    ['escalationBackupName', 'Backup escalation contact'],
    ['escalationBackupPhone', 'Backup escalation phone'],
  ]],
  ['How the AI Should Sound', [
    ['greeting', 'Greeting preference'],
    ['tone', 'Tone'],
    ['faqs', 'Common questions & answers'],
    ['pricingPolicy', 'Can the AI quote prices?'],
    ['pricingRanges', 'Price ranges'],
    ['guardrails', 'Never say / promise'],
    ['additionalNotes', 'Anything else'],
    ['attribution', 'How they heard about CallerCore'],
  ]],
];

function wrap(text, font, size, maxWidth) {
  const out = [];
  String(text).split('\n').forEach((para) => {
    const words = para.split(' ');
    let line = '';
    words.forEach((w) => {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) { out.push(line); line = w; }
      else { line = test; }
    });
    out.push(line);
  });
  return out;
}

async function buildIntakeSummaryPdf({ business, contactName, plan, intake, submittedAt }) {
  const doc = await PDFDocument.create();
  doc.setTitle('CallerCore Intake Summary');
  doc.setAuthor('CallerCore');
  doc.setSubject('Client Intake Summary');

  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo   = await doc.embedPng(Buffer.from(LOGO_BASE64, 'base64'));

  const pages = [];
  let page, y;

  function newPage(first) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });

    if (first) {
      page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: NAVY });
      const dims = logo.scale(26 / logo.height);
      page.drawImage(logo, {
        x: MARGIN, y: PAGE_H - BAND_H + (BAND_H - dims.height) / 2,
        width: dims.width, height: dims.height,
      });
      const t = 'INTAKE SUMMARY';
      page.drawText(t, {
        x: PAGE_W - MARGIN - bold.widthOfTextAtSize(t, 10.5),
        y: PAGE_H - BAND_H / 2 - 3.5, size: 10.5, font: bold, color: rgb(1, 1, 1), opacity: 0.9,
      });
      y = PAGE_H - BAND_H - 42;
    } else {
      page.drawText('CallerCore Intake Summary — ' + (business || ''), { x: MARGIN, y: PAGE_H - 46, size: 8.5, font, color: MUTED });
      page.drawLine({
        start: { x: MARGIN, y: PAGE_H - 56 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 56 },
        thickness: 0.5, color: HAIRLINE,
      });
      y = PAGE_H - 80;
    }
  }

  function space(needed) { if (y - needed < BOTTOM_LIMIT) newPage(false); }

  function para(text, opts) {
    opts = opts || {};
    const size = opts.size || 9.8;
    const f = opts.f || font;
    const color = opts.color || INK;
    const lead = opts.lead || 4.4;
    const gapAfter = opts.gap === undefined ? 9 : opts.gap;
    wrap(text, f, size, CONTENT_W).forEach((line) => {
      space(size + lead);
      page.drawText(line, { x: MARGIN, y, size, font: f, color });
      y -= size + lead;
    });
    y -= gapAfter;
  }

  function field(label, value) {
    space(28);
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: 7.5, font: bold, color: MUTED });
    y -= 12;
    wrap(value, font, 10, CONTENT_W).forEach((line) => {
      space(14);
      page.drawText(line, { x: MARGIN, y, size: 10, font, color: INK });
      y -= 14;
    });
    y -= 8;
  }

  newPage(true);

  para('Client Intake Summary', { size: 20, f: bold, gap: 6 });
  page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: MARGIN + 52, y: y + 4 }, thickness: 2.5, color: SIGNAL });
  y -= 16;

  const meta = [
    ['Business', business || '—'],
    ['Contact', contactName || '—'],
    ['Plan', plan || '—'],
    ['Submitted', submittedAt || '—'],
  ];
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.5, color: HAIRLINE });
  y -= 10;
  meta.forEach((row) => {
    space(18);
    page.drawText(row[0].toUpperCase(), { x: MARGIN, y, size: 7.5, font: bold, color: MUTED });
    page.drawText(String(row[1]), { x: MARGIN + 92, y, size: 10, font, color: INK });
    y -= 17;
  });
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.5, color: HAIRLINE });
  y -= 24;

  const data = intake || {};
  SECTIONS.forEach(([sectionTitle, fields]) => {
    const present = fields.filter(([key]) => data[key] && String(data[key]).trim() !== '');
    if (!present.length) return;
    space(40);
    para(sectionTitle, { size: 12.5, f: bold, color: SIGNAL, gap: 8 });
    present.forEach(([key, label]) => field(label, data[key]));
    y -= 4;
  });

  pages.forEach((pg, i) => {
    pg.drawLine({
      start: { x: MARGIN, y: FOOTER_Y + 16 }, end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 16 },
      thickness: 0.5, color: HAIRLINE,
    });
    pg.drawText('CallerCore \u00b7 internal use', { x: MARGIN, y: FOOTER_Y, size: 8, font, color: MUTED });
    const label = 'Page ' + (i + 1) + ' of ' + pages.length;
    pg.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8), y: FOOTER_Y, size: 8, font, color: MUTED,
    });
  });

  return doc.save();
}

module.exports = { buildIntakeSummaryPdf, SECTIONS };
