const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
  } = process.env;

  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  } else {
    // Fallback: “console mailer”
    transporter = {
      sendMail: async (opts) => {
        /* eslint-disable no-console */
        console.log('=== [DEV MAIL] =================================');
        console.log('TO:      ', opts.to);
        console.log('SUBJECT: ', opts.subject);
        console.log('TEXT:    ', opts.text);
        console.log('HTML:    ', opts.html);
        console.log('===============================================');
        /* eslint-enable no-console */
        return { messageId: 'console-mail' };
      }
    };
  }
  return transporter;
}

async function sendMail({ to, subject, text, html, from }) {
  const fromAddr = from || process.env.SMTP_FROM || 'no-reply@example.com';
  const tx = getTransporter();
  return tx.sendMail({ from: fromAddr, to, subject, text, html });
}

module.exports = { sendMail };
