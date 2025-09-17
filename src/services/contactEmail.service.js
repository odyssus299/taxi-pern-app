// Χρησιμοποιεί τον υπάρχοντα mailer (όπως στα reviews)
const mailer = require('./mailer');

const ADMIN_EMAIL = 'info@avtaxi.gr';

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

exports.sendContactEmail = async ({ fullName, email, subject, message }) => {
  const safeName = escapeHtml(fullName);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message || '');

  const mailSubject = `📨 Νέο μήνυμα επικοινωνίας: ${safeSubject}`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">
      <h2 style="margin:0 0 12px 0">Νέο μήνυμα επικοινωνίας</h2>
      <p><strong>Όνομα:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Θέμα:</strong> ${safeSubject}</p>
      <p><strong>Μήνυμα:</strong></p>
      <pre style="white-space:pre-wrap;background:#f7f7f7;border:1px solid #eee;padding:12px;border-radius:6px">${safeMessage}</pre>
    </div>
  `;
  const text =
    `Νέο μήνυμα επικοινωνίας\n` +
    `Όνομα: ${fullName}\n` +
    `Email: ${email}\n` +
    `Θέμα: ${subject}\n\n` +
    `Μήνυμα:\n${message || ''}\n`;

  // ίδιο API με το reviewEmail.service / mailer.js
  await mailer.sendMail({
    to: ADMIN_EMAIL,
    subject: mailSubject,
    html,
    text,
  });
};
