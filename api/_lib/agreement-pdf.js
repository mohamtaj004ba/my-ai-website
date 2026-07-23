const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const LOGO_BASE64 = require('./logo-base64');
const { CLAUSES } = require('./agreement-clauses');

// Brand palette
const INK      = rgb(0.12, 0.13, 0.16);
const MUTED    = rgb(0.45, 0.47, 0.51);
const HAIRLINE = rgb(0.85, 0.86, 0.88);
const SIGNAL   = rgb(0.824, 0.404, 0.235); // #D2673C
const NAVY     = rgb(0.047, 0.118, 0.220); // #0C1E38
const PAPER    = rgb(1, 1, 1);

const PAGE_W = 612, PAGE_H = 792;
const MARGIN = 62;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BAND_H = 96;
const FOOTER_Y = 44;
const BOTTOM_LIMIT = 74;

function wrap(text, font, size, maxWidth) {
  const out = [];
  text.split('\n').forEach((para) => {
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

async function buildAgreementPdfBytes({ business, fullName, plan, signedAt }) {
  const doc = await PDFDocument.create();
  doc.setTitle('CallerCore Service Agreement');
  doc.setAuthor('CallerCore');
  doc.setSubject('Service Agreement');

  const font   = await doc.embedFont(StandardFonts.Helvetica);
  const bold   = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const logo   = await doc.embedPng(Buffer.from(LOGO_BASE64, 'base64'));

  const pages = [];
  let page, y;

  function newPage(first) {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });

    if (first) {
      // Dark letterhead band — the logo's wordmark is white, so it needs a dark ground.
      page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: NAVY });
      const dims = logo.scale(26 / logo.height);
      page.drawImage(logo, {
        x: MARGIN, y: PAGE_H - BAND_H + (BAND_H - dims.height) / 2,
        width: dims.width, height: dims.height,
      });
      const t = 'SERVICE AGREEMENT';
      page.drawText(t, {
        x: PAGE_W - MARGIN - bold.widthOfTextAtSize(t, 10.5),
        y: PAGE_H - BAND_H / 2 - 3.5, size: 10.5, font: bold, color: rgb(1, 1, 1), opacity: 0.9,
      });
      y = PAGE_H - BAND_H - 42;
    } else {
      page.drawText('CallerCore Service Agreement', { x: MARGIN, y: PAGE_H - 46, size: 8.5, font, color: MUTED });
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
    const indent = opts.indent || 0;
    wrap(text, f, size, CONTENT_W - indent).forEach((line) => {
      space(size + lead);
      page.drawText(line, { x: MARGIN + indent, y, size, font: f, color });
      y -= size + lead;
    });
    y -= gapAfter;
  }

  newPage(true);

  para('Service Agreement', { size: 22, f: bold, gap: 8 });
  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: MARGIN + 52, y: y + 6 }, thickness: 2.5, color: SIGNAL });
  y -= 18;

  const meta = [
    ['Between', 'CallerCore'],
    ['And', business || 'Client'],
    ['Plan', plan || '-'],
    ['Date', signedAt || '-'],
  ];
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.5, color: HAIRLINE });
  y -= 10;
  meta.forEach(function (row) {
    space(18);
    page.drawText(row[0].toUpperCase(), { x: MARGIN, y: y, size: 7.5, font: bold, color: MUTED });
    page.drawText(String(row[1]), { x: MARGIN + 92, y: y, size: 10, font, color: INK });
    y -= 17;
  });
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 0.5, color: HAIRLINE });
  y -= 24;

  CLAUSES.forEach(function (c) {
    space(48);
    para(c[0], { size: 11, f: bold, color: SIGNAL, gap: 5 });
    c[1].split('\n').forEach(function (block) {
      const isSub = /^\d+\.\d+\s/.test(block);
      para(block, { gap: isSub ? 5 : 9, indent: isSub ? 14 : 0 });
    });
    y -= 4;
  });

  const BOX_H = 132;
  if (y - BOX_H < BOTTOM_LIMIT) newPage(false);
  y -= 10;
  const boxTop = y;
  page.drawRectangle({
    x: MARGIN, y: boxTop - BOX_H, width: CONTENT_W, height: BOX_H,
    borderColor: HAIRLINE, borderWidth: 1, color: rgb(0.985, 0.985, 0.99),
  });
  page.drawRectangle({ x: MARGIN, y: boxTop - 4, width: CONTENT_W, height: 4, color: SIGNAL });

  let by = boxTop - 26;
  page.drawText('EXECUTION', { x: MARGIN + 18, y: by, size: 8, font: bold, color: MUTED });
  by -= 24;
  page.drawText('Signed by', { x: MARGIN + 18, y: by, size: 8, font: bold, color: MUTED });
  page.drawText(fullName || '', { x: MARGIN + 18, y: by - 22, size: 17, font: italic, color: INK });
  page.drawLine({
    start: { x: MARGIN + 18, y: by - 29 }, end: { x: MARGIN + CONTENT_W / 2 - 16, y: by - 29 },
    thickness: 0.75, color: rgb(0.6, 0.62, 0.66),
  });

  const rx = MARGIN + CONTENT_W / 2 + 8;
  page.drawText('On behalf of', { x: rx, y: by, size: 8, font: bold, color: MUTED });
  page.drawText(business || '', { x: rx, y: by - 18, size: 11, font: bold, color: INK });
  page.drawText('Date', { x: rx, y: by - 44, size: 8, font: bold, color: MUTED });
  page.drawText(signedAt || '', { x: rx, y: by - 60, size: 11, font, color: INK });

  page.drawText('Executed electronically via CallerCore\u2019s onboarding system.', {
    x: MARGIN + 18, y: boxTop - BOX_H + 16, size: 8, font, color: MUTED,
  });

  pages.forEach(function (pg, i) {
    pg.drawLine({
      start: { x: MARGIN, y: FOOTER_Y + 16 }, end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 16 },
      thickness: 0.5, color: HAIRLINE,
    });
    pg.drawText('CallerCore \u00b7 support@callercore.com', { x: MARGIN, y: FOOTER_Y, size: 8, font, color: MUTED });
    const label = 'Page ' + (i + 1) + ' of ' + pages.length;
    pg.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8), y: FOOTER_Y, size: 8, font, color: MUTED,
    });
  });

  return doc.save();
}

module.exports = { buildAgreementPdfBytes };
