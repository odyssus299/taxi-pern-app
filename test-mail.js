// test-mail.js
const nodemailer = require('nodemailer');

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),         // 587 για STARTTLS, 465 για SSL
    secure: process.env.SMTP_SECURE === 'true',  // true μόνο με 465
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  // έλεγχος σύνδεσης
  await transporter.verify();
  console.log('✅ SMTP connection OK');

  // στείλε δοκιμαστικό
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,                 // π.χ. "KavalaTaxi <taxitest@metakomhsh.gr>"
    to: 'info@web-mate.gr',
    subject: 'SMTP test from KavalaTaxi',
    text: 'It works 🎉',
  });

  console.log('✉️  Sent message id:', info.messageId);
}

main().catch((err) => {
  console.error('❌ SMTP error:', err);
  process.exit(1);
});
