const crypto = require('crypto');
const { sessions } = require('../data/sessions');

/** Γρήγορο parse cookies χωρίς cookie-parser */
function parseCookie(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > -1) {
      const k = p.slice(0, idx).trim();
      const v = decodeURIComponent(p.slice(idx + 1).trim());
      out[k] = v;
    }
  });
  return out;
}

module.exports = function session(req, res, next) {
  const cookies = parseCookie(req.headers.cookie || '');
  const sid = cookies.sid;

  if (sid && sessions.has(sid)) {
    req.sid = sid;
    req.session = sessions.get(sid);
  } else {
    req.sid = null;
    req.session = null;
  }

  req.createSession = (payload) => {
    const newSid = crypto.randomBytes(16).toString('hex');
    sessions.set(newSid, { ...payload, createdAt: new Date().toISOString() });

    // ΣΗΜΑΝΤΙΚΟ: path:'/api' για να ισχύει σε ΟΛΑ τα /api/... (GET/POST/PATCH/DELETE)
    res.cookie('sid', newSid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,          // σε dev χωρίς HTTPS
      path: '/api',           // <— αυτό έλειπε
      maxAge: 30 * 24 * 60 * 60 * 1000, // προαιρετικό
    });

    req.sid = newSid;
    req.session = sessions.get(newSid);
  };

  // Καταστροφή τρέχοντος session
  req.destroySession = () => {
    if (req.sid) sessions.delete(req.sid);
    // ΣΗΜΑΝΤΙΚΟ: σβήσε με το ΙΔΙΟ path που γράψαμε
    res.clearCookie('sid', { path: '/api' });
    req.sid = null;
    req.session = null;
  };

  next();
};