/* =========================================================
   Value Lab — Password Hashing Utilities
   ─────────────────────────────────────────────
   - hashPassword(plain) → Argon2id hash
   - verifyPassword(plain, hash) → boolean
   - isArgonHash(value) → boolean

   لا يُخزّن أي password كنص صريح في أي مكان.
   ========================================================= */

const argon2 = require('argon2');

// إعدادات Argon2id موصى بها من OWASP (2023)
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,   // 64 MB
  timeCost: 3,
  parallelism: 1,
};

/**
 * تشفير كلمة المرور
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  if (plainPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (plainPassword.length > 200) {
    throw new Error('Password is too long');
  }
  return argon2.hash(plainPassword, ARGON_OPTIONS);
}

/**
 * التحقق من كلمة المرور
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false;
  if (typeof plainPassword !== 'string' || typeof hash !== 'string') return false;
  try {
    return await argon2.verify(hash, plainPassword);
  } catch (_) {
    // hash تالف أو صيغة غير صحيحة
    return false;
  }
}

/**
 * فحص إذا كانت القيمة hash صالح لـArgon2
 * @param {string} value
 * @returns {boolean}
 */
function isArgonHash(value) {
  return typeof value === 'string' && value.startsWith('$argon2');
}

module.exports = {
  hashPassword,
  verifyPassword,
  isArgonHash,
};