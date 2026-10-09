const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'People Action Check';
pptx.subject = 'One-page Slack app overview';
pptx.title = 'People Action Check | One-page Slack overview';
pptx.company = 'People Action Check';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Georgia',
  bodyFontFace: 'Aptos',
  lang: 'en-US'
};

const slide = pptx.addSlide();
slide.background = { color: 'FFFFFF' };

const C = {
  ink: '18142F',
  muted: '5B5B63',
  purple: '6046A5',
  teal: '087C73',
  blue: '087EA4',
  lavender: 'E9E5F6',
  mint: 'DDF2EC',
  gray: 'F3F3F5',
  yellow: 'FFF0CF'
};

slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.333, h: 0.14,
  line: { color: C.purple, transparency: 100 },
  fill: { color: C.purple }
});

slide.addText('PEOPLE ACTION CHECK', {
  x: 0.62, y: 0.46, w: 6.6, h: 0.46,
  fontFace: 'Georgia', fontSize: 29, bold: true,
  color: C.ink, margin: 0, fit: 'shrink'
});
slide.addText('One-page Slack app overview  •  October 2026', {
  x: 0.64, y: 1.03, w: 5.8, h: 0.3,
  fontFace: 'Georgia', fontSize: 14.5,
  color: C.muted, margin: 0
});

slide.addShape(pptx.ShapeType.roundRect, {
  x: 9.65, y: 0.39, w: 3.03, h: 0.57,
  rectRadius: 0.08,
  line: { color: C.mint, transparency: 100 },
  fill: { color: C.mint }
});
slide.addText('PILOT VALIDATED | CONTROLS ACTIVE', {
  x: 9.85, y: 0.56, w: 2.63, h: 0.22,
  fontFace: 'Georgia', fontSize: 12.5, bold: true,
  color: C.teal, align: 'center', margin: 0
});

function card({ x, y, w, h, fill, title, titleColor = C.ink, body, fontSize = 15.2 }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    line: { color: fill, transparency: 100 },
    fill: { color: fill }
  });
  slide.addText(title, {
    x: x + 0.28, y: y + 0.31, w: w - 0.56, h: 0.36,
    fontFace: 'Georgia', fontSize: 20.5, bold: true,
    color: titleColor, margin: 0, fit: 'shrink'
  });
  slide.addText(body, {
    x: x + 0.28, y: y + 0.83, w: w - 0.56, h: h - 1.07,
    fontFace: 'Georgia', fontSize,
    color: '202024', margin: 0,
    breakLine: false, valign: 'top', fit: 'shrink',
    paraSpaceAfterPt: 0, lineSpacingMultiple: 1.02
  });
}

card({
  x: 0.62, y: 1.58, w: 6.04, h: 2.23, fill: C.lavender,
  title: 'Manager workflow working now', fontSize: 13.7,
  body: 'ASSESS — 10 situations, 50 questions and three risk levels\nDOCUMENT — Notes, links, files and Word reports\nCONTINUE — Save/resume, private history and policy viewing\nESCALATE — Explicit private submission to HR'
});

card({
  x: 6.89, y: 1.58, w: 5.79, h: 2.23, fill: C.mint,
  title: 'HR workflow working now', titleColor: C.teal, fontSize: 13.7,
  body: 'RECEIVE — Private alerts and protected review queue\nREVIEW — Submitter names, risk ratings and attachments\nRESPOND — Status, review notes and manager notification\nMANAGE — Policy add, edit and delete controls'
});

card({
  x: 0.62, y: 4.03, w: 6.04, h: 2.35, fill: C.gray,
  title: 'Governance working now', fontSize: 13.7,
  body: 'ACCESS — Slack identity, owner checks and HR allowlist\nPRIVACY — Private drafts and fixed HR submission snapshots\nCONTROL — Restricted policy administration, retention and audit history\nRECOVER — Delivery retry and daily verified backups'
});

card({
  x: 6.89, y: 4.03, w: 5.79, h: 2.35, fill: C.yellow,
  title: 'Access and data working now', fontSize: 13.7,
  body: 'REACH — One shared app for Slack workspace members\nDEVICES — Desktop, web and mobile access\nDATA — SQLite app records; Slack-retained messages and files\nONBOARDING — No separate installation for each manager'
});

slide.addText('NEXT STEP', {
  x: 0.65, y: 6.76, w: 1.15, h: 0.23,
  fontFace: 'Georgia', fontSize: 11.5, bold: true,
  color: C.purple, charSpacing: 1.1, margin: 0
});
slide.addText('Expand the multi-user pilot on existing company infrastructure;\ntransition operations, data protection and support to IT.', {
  x: 1.86, y: 6.61, w: 10.6, h: 0.58,
  fontFace: 'Georgia', fontSize: 14.5, bold: true,
  color: C.blue, margin: 0, fit: 'shrink'
});

pptx.writeFile({ fileName: __dirname + '/People-Action-Check-One-Page-Overview.pptx' });
