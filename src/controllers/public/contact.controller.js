const { sendContactEmail } = require('../../services/contactEmail.service');
const HttpError = require('../../utils/HttpError'); // ίδιο που χρησιμοποιείς στα άλλα controllers

exports.submit = async (req, res, next) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email    = String(req.body?.email    || '').trim();
  const subject  = String(req.body?.subject  || '').trim();
  const message  = String(req.body?.message  || '').trim();
  const faxTrap  = String(req.body?.fax      || '').trim(); // honeypot

  // Αν το honeypot γέμισε, το αντιμετωπίζουμε σαν επιτυχία αλλά δεν στέλνουμε email.
  if (faxTrap) {
    return res.json({
      success: true,
      message: 'Ευχαριστούμε! Το μήνυμά σας έχει σταλεί.'
    });
  }

  // Απλοί έλεγχοι (το validate στον router θα κάνει τα επίσημα 422)
  if (!fullName || !email || !subject) {
    return next(new HttpError('Συμπληρώστε όλα τα υποχρεωτικά πεδία.', 422));
  }

  try {
    await sendContactEmail({ fullName, email, subject, message });
    return res.json({
      success: true,
      message: 'Ευχαριστούμε! Το μήνυμά σας έχει σταλεί.'
    });
  } catch (e) {
    return next(new HttpError('Αποτυχία αποστολής μηνύματος. Προσπαθήστε ξανά.', 500));
  }
};
