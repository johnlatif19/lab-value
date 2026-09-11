const { verifyAccessToken } = require('../utils/jwt');

/**
 * استخراج التوكن من cookies أو Authorization header
 */
function extractToken(req) {
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

/**
 * Middleware: يتطلب تسجيل دخول
 */
function requirePageAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) return res.redirect('/login');

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    return next();
  } catch (_) {
    // امسح الكوكي التالف
    res.clearCookie('accessToken');
    return res.redirect('/login');
  }
}

/**
 * Middleware: يتطلب دور Admin (يُستخدم بعد requirePageAuth)
 * الأدوار المسموح بها: SUPER_ADMIN, ADMIN, LAB_MANAGER
 */
function requireAdmin(req, res, next) {
  const role = (req.user && req.user.role) ? String(req.user.role).toUpperCase() : '';
  const allowed = ['SUPER_ADMIN', 'ADMIN', 'LAB_MANAGER'];
  if (!allowed.includes(role)) {
    return res.redirect('/loginpanel');
  }
  return next();
}

module.exports = requirePageAuth;
module.exports.requirePageAuth = requirePageAuth;
module.exports.requireAdmin = requireAdmin;
