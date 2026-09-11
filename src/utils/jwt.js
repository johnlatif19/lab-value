/* =========================================================
   Value Lab — JWT Utilities
   ─────────────────────────────────────────────
   - signAccessToken(payload)   → 15m افتراضيًا
   - signRefreshToken(payload)  → 7d افتراضيًا
   - verifyAccessToken(token)   → decoded payload
   - verifyRefreshToken(token)  → decoded payload

   جميع التوكنات موقّعة بـJWT_SECRET من .env.
   التوكنات تُخزّن في cookies httpOnly فقط.
   ========================================================= */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET must be set and at least 16 chars in .env');
}

/**
 * إنشاء access token
 * @param {object} payload - { sub, role, ... }
 * @returns {string}
 */
function signAccessToken(payload = {}) {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES, issuer: 'value-lab' }
  );
}

/**
 * إنشاء refresh token
 * @param {object} payload
 * @returns {string}
 */
function signRefreshToken(payload = {}) {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES, issuer: 'value-lab' }
  );
}

/**
 * التحقق من access token
 * @param {string} token
 * @returns {object}
 * @throws {Error}
 */
function verifyAccessToken(token) {
  if (!token) throw new Error('Token is required');
  const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'value-lab' });
  if (decoded.type !== 'access') throw new Error('Invalid token type');
  return decoded;
}

/**
 * التحقق من refresh token
 * @param {string} token
 * @returns {object}
 */
function verifyRefreshToken(token) {
  if (!token) throw new Error('Token is required');
  const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'value-lab' });
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return decoded;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};