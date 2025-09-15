const jwt = require('jsonwebtoken');
const HttpError = require('../utils/HttpError');

function getSecret() {
  return process.env.JWT_SECRET || process.env.JWT_KEY;
}

/** χρήση:
 *  router.use(checkAuth());           // απλή αυθεντικοποίηση
 *  router.use(checkAuth('admin'));    // + επιβολή ρόλου
 */
module.exports = function checkAuth(requiredRole) {
  return (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    try {
      const auth = req.headers?.authorization || '';
      const [scheme, token] = auth.split(' ');
      if ((scheme || '').toLowerCase() !== 'bearer' || !token) {
        return next(new HttpError('Λείπει το Authorization header.', 401));
      }
      const decoded = jwt.verify(token, getSecret());
      // Ενοποιούμε ονόματα για συμβατότητα με τον υπάρχοντα κώδικα
      req.user = { id: decoded.userId, role: decoded.userRole || decoded.role };
      req.userData = { userId: decoded.userId, userRole: decoded.userRole || decoded.role };

      if (requiredRole && req.user.role !== requiredRole) {
        return next(new HttpError('Απαγορευμένο.', 403));
      }
      return next();
    } catch (_e) {
      return next(new HttpError('Η αυθεντικοποίηση απέτυχε, παρακαλώ προσπαθήστε ξανά.', 401));
    }
  };
};
