const https = require('https');
const crypto = require('crypto');

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'mail.callercore.com';

// Sends via Mailgun. Pass `attachments: [{ filename, data (Buffer), contentType }]`
// to include files — Mailgun's API needs multipart/form-data for that, so this
// builds the multipart body by hand rather than pulling in a form-data library.
function sendMail({ to, subject, text, html, attachments = [] }) {
  return new Promise((resolve, reject) => {
    const boundary = '----ccmail' + crypto.randomBytes(16).toString('hex');
    const parts = [];

    function field(name, value) {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    }

    field('from', 'CallerCore <support@callercore.com>');
    field('to', to);
    field('subject', subject);
    field('text', text);
    field('html', html);

    attachments.forEach((att) => {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="${att.filename}"\r\nContent-Type: ${att.contentType || 'application/octet-stream'}\r\n\r\n`
      ));
      parts.push(att.data);
      parts.push(Buffer.from('\r\n'));
    });

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(parts);

    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');
    const options = {
      hostname: 'api.mailgun.net',
      path: `/v3/${MAILGUN_DOMAIN}/messages`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let resBody = '';
      res.on('data', (c) => { resBody += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(resBody);
        else reject(new Error(`Mailgun error ${res.statusCode}: ${resBody}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendMail };
