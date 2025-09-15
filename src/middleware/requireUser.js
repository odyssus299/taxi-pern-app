// module.exports = function requireUser(req, res, next) {
//     // why: κόβουμε πρόσβαση σε μη συνδεδεμένους user ρόλους
//     if (req.session?.role !== 'user') {
//       req.destroySession?.();
//       return res.status(401).json({ success: false, message: 'Δεν είστε συνδεδεμένος.' });
//     }
//     next();
//   };