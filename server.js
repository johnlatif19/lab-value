require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const hpp = require('hpp');
const { v4: uuidv4 } = require('uuid');

// ─── Firebase (Firestore) ────────────────────
const { initFirebase, getDb } = require('./src/config/firebase');
initFirebase();

// ─── Helpers ─────────────────────────────────
let hashPassword = async () => '';
let verifyPassword = async () => false;
let signAccessToken = () => '';
let signRefreshToken = () => '';
let verifyAccessToken = () => ({});
let verifyRefreshToken = () => ({});
let requirePageAuth = (req, res, next) => next();
let requireAdmin = (req, res, next) => next();

try {
  ({ hashPassword, verifyPassword } = require('./src/utils/password'));
  ({
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
  } = require('./src/utils/jwt'));
  requirePageAuth = require('./src/middleware/requirePageAuth');
  ({ requireAdmin } = require('./src/middleware/requirePageAuth'));
} catch (err) {
  console.warn('⚠️  src/ modules not ready:', err.message);
}

// ─── Environment validation ──────────────────
const REQUIRED_ENV = ['NODE_ENV', 'JWT_SECRET', 'SESSION_SECRET', 'CSRF_SECRET'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('❌ Missing required env vars:', missing.join(', '));
  if (process.env.NODE_ENV === 'production') process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Hardening ───────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(hpp());
app.use(compression());
app.use(cors({ origin: process.env.APP_URL || true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// ─── Rate limiting ───────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 800,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts.' },
});
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// ─── Static assets (dual mount) ──────────────
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use('/public', express.static(PUBLIC_DIR, { maxAge: IS_PROD ? '1h' : 0 }));
app.use('/css', express.static(path.join(PUBLIC_DIR, 'css'), { maxAge: IS_PROD ? '1h' : 0 }));
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js'), { maxAge: IS_PROD ? '1h' : 0 }));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { maxAge: IS_PROD ? '7d' : 0 }));
app.use('/auth/css', express.static(path.join(PUBLIC_DIR, 'auth', 'css')));
app.use('/auth/js', express.static(path.join(PUBLIC_DIR, 'auth', 'js')));

// ═════════════════════════════════════════════
//  In-memory stores (سيتم استبدالها بـFirestore تدريجيًا)
// ═════════════════════════════════════════════

const store = {
  users: new Map(),
  usersByUsername: new Map(),
  tests: new Map(),
  packages: new Map(),
  branches: new Map(),
  orders: new Map(),
  results: new Map(),
  homeVisits: new Map(),
  notifications: new Map(),
  points: new Map(),
  resetTokens: new Map(),
  verifyTokens: new Map(),
  auditLogs: [],
  settings: {
    pointsPer10: 1,
    minRedeem: 100,
    contactEmail: 'info@valuelab.local',
    contactPhone: '+20 100 000 0000',
  },
};

// ─── Seed data ───────────────────────────────
function seed() {
  [
    { id: 'cbc', name: 'صورة دم كاملة', description: 'تحليل شامل لمكونات الدم', price: 120, category: 'أمراض الدم', sampleType: 'دم', turnaround: '24 ساعة', active: true, featured: true },
    { id: 'glucose', name: 'سكر صائم', description: 'قياس مستوى السكر في الدم', price: 60, category: 'كيمياء', sampleType: 'دم', turnaround: '24 ساعة', active: true, featured: true },
    { id: 'lipid', name: 'دهون كاملة', description: 'قياس الكوليسترول والدهون الثلاثية', price: 180, category: 'كيمياء', sampleType: 'دم', turnaround: '24 ساعة', active: true, featured: true },
    { id: 'tsh', name: 'هرمون الغدة الدرقية', description: 'تحليل وظائف الغدة الدرقية', price: 200, category: 'هرمونات', sampleType: 'دم', turnaround: '48 ساعة', active: true, featured: false },
    { id: 'vitd', name: 'فيتامين د', description: 'قياس مستوى فيتامين د', price: 350, category: 'فيتامينات', sampleType: 'دم', turnaround: '48 ساعة', active: true, featured: false },
  ].forEach((t) => store.tests.set(t.id, t));

  [
    { id: 'basic', name: 'الباقة الأساسية', description: 'صورة دم كاملة + سكر صائم', price: 150, originalPrice: 180, category: 'باقات عامة', testsCount: 2, active: true, featured: true, tests: ['cbc', 'glucose'] },
    { id: 'comprehensive', name: 'الباقة الشاملة', description: 'تحاليل شاملة لأهم وظائف الجسم', price: 450, originalPrice: 620, category: 'باقات عامة', testsCount: 4, active: true, featured: true, tests: ['cbc', 'glucose', 'lipid', 'tsh'] },
    { id: 'heart', name: 'باقة صحة القلب', description: 'دهون كاملة + إنزيمات القلب', price: 320, originalPrice: 420, category: 'باقات متخصصة', testsCount: 3, active: true, featured: true, tests: ['lipid', 'glucose'] },
  ].forEach((p) => store.packages.set(p.id, p));

  [
    { id: 'main', name: 'الفرع الرئيسي', address: 'شارع التحرير، وسط البلد', phone: '+20 100 000 0000', hours: '8 ص - 10 م', active: true },
    { id: 'nasr', name: 'فرع مدينة نصر', address: 'عباس العقاد، مدينة نصر', phone: '+20 100 000 0001', hours: '8 ص - 10 م', active: true },
    { id: 'maadi', name: 'فرع المعادي', address: 'شارع 9، المعادي', phone: '+20 100 000 0002', hours: '8 ص - 10 م', active: true },
  ].forEach((b) => store.branches.set(b.id, b));
}
seed();

// ═════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════

function ok(res, data = null, message = null) {
  return res.json({ success: true, ...(data !== null ? { data } : {}), ...(message ? { message } : {}) });
}
function fail(res, status, message, code = null) {
  return res.status(status).json({ success: false, message, ...(code ? { code } : {}) });
}

function setAuthCookies(res, user) {
  const payload = { sub: user.id, role: user.role || 'PATIENT', username: user.username };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  const base = { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/' };
  res.cookie('accessToken', access, { ...base, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}
function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}
function getUserFromReq(req) {
  const token = req.cookies?.accessToken;
  if (!token) return null;
  try { return verifyAccessToken(token); } catch (_) { return null; }
}
function requireApiAuth(req, res, next) {
  const decoded = getUserFromReq(req);
  if (!decoded) return fail(res, 401, 'Unauthorized');
  req.user = decoded;
  return next();
}
function requireApiAdmin(req, res, next) {
  const decoded = getUserFromReq(req);
  if (!decoded) return fail(res, 401, 'Unauthorized');
  const role = String(decoded.role || '').toUpperCase();
  if (!['SUPER_ADMIN', 'ADMIN', 'LAB_MANAGER'].includes(role)) {
    return fail(res, 403, 'Forbidden');
  }
  req.user = decoded;
  return next();
}
function audit(req, action, resource = null, resourceId = null, meta = {}) {
  store.auditLogs.unshift({
    id: uuidv4(),
    userId: req.user?.sub || null,
    userName: req.user?.username || null,
    action,
    resource,
    resourceId,
    ip: req.ip,
    meta,
    createdAt: new Date().toISOString(),
  });
  if (store.auditLogs.length > 2000) store.auditLogs.length = 2000;
}

// ═════════════════════════════════════════════
//  Pages — Public
// ═════════════════════════════════════════════

function sendPage(file) {
  return (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));
}

app.get('/', sendPage('index.html'));
app.get('/login', sendPage('login.html'));
app.get('/sign-up', sendPage('sign-up.html'));
app.get('/forgot-password', sendPage('forgot-password.html'));
app.get('/reset-password', sendPage('reset-password.html'));
app.get('/verify-email', sendPage('verify-email.html'));

// ✅ Admin login page — clean URL
app.get('/loginpanel', sendPage('auth/loginpanel.html'));

// ═════════════════════════════════════════════
//  Pages — Protected (تسجيل دخول مطلوب)
// ═════════════════════════════════════════════

app.get('/result', requirePageAuth, sendPage('result.html'));
app.get('/testspackages', requirePageAuth, sendPage('testspackages.html'));
app.get('/points', requirePageAuth, sendPage('points.html'));
app.get('/book-visit', requirePageAuth, sendPage('book-visit.html'));
app.get('/profile', requirePageAuth, sendPage('profile.html'));
app.get('/notifications', requirePageAuth, sendPage('notifications.html'));

// ✅ Dashboard — protected + admin only
app.get('/dashboard', requirePageAuth, requireAdmin, sendPage('auth/dashboard.html'));

// ═════════════════════════════════════════════
//  API — Meta
// ═════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    message: 'Value Lab API running',
    env: process.env.NODE_ENV,
    firestore: db ? 'connected' : 'disabled',
    time: new Date().toISOString(),
  });
});

app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('csrfToken', token, { httpOnly: false, sameSite: 'lax', secure: IS_PROD, maxAge: 2 * 60 * 60 * 1000 });
  res.json({ success: true, csrfToken: token });
});

// ═════════════════════════════════════════════
//  API — Auth (Patient)
// ═════════════════════════════════════════════

app.post('/api/auth/signup', async (req, res) => {
  try {
    const b = req.body || {};
    const { firstName, lastName, username, phone, email, password, gender, dob, address } = b;
    if (!firstName || !lastName || !username || !phone || !email || !password) {
      return fail(res, 400, 'كل الحقول مطلوبة');
    }
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) return fail(res, 400, 'اسم المستخدم غير صالح');
    const uname = username.toLowerCase();
    if (store.usersByUsername.has(uname)) return fail(res, 409, 'اسم المستخدم مستخدم بالفعل');

    const id = uuidv4();
    const passwordHash = await hashPassword(password);
    const user = {
      id, firstName: String(firstName).trim(), lastName: String(lastName).trim(),
      username: uname, phone: String(phone).trim(),
      email: String(email).trim().toLowerCase(), passwordHash,
      gender: gender || null, dob: dob || null, address: address || {},
      role: 'PATIENT', active: true, emailVerified: false,
      createdAt: new Date().toISOString(),
    };
    store.users.set(id, user);
    store.usersByUsername.set(uname, id);
    store.points.set(id, { balance: 0, totalEarned: 0, totalRedeemed: 0, transactions: [], updatedAt: new Date().toISOString() });
    audit({ user: { sub: id, username: uname }, ip: req.ip }, 'SIGNUP', 'user', id);
    return ok(res, { id, username: uname }, 'تم إنشاء الحساب');
  } catch (err) {
    console.error('signup:', err.message);
    return fail(res, 500, 'حدث خطأ أثناء التسجيل');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, 400, 'بيانات ناقصة');
    const id = store.usersByUsername.get(String(username).toLowerCase());
    if (!id) return fail(res, 401, 'اسم المستخدم أو كلمة السر غير صحيحة');
    const user = store.users.get(id);
    if (!user || user.active === false) return fail(res, 401, 'الحساب معطّل');
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return fail(res, 401, 'اسم المستخدم أو كلمة السر غير صحيحة');
    setAuthCookies(res, user);
    audit({ user: { sub: id, username: user.username }, ip: req.ip }, 'LOGIN', 'user', id);
    return ok(res, { redirect: '/result' }, 'تم الدخول');
  } catch (err) {
    console.error('login:', err.message);
    return fail(res, 500, 'حدث خطأ أثناء الدخول');
  }
});

app.post('/api/auth/logout', (req, res) => {
  const u = getUserFromReq(req);
  if (u) audit({ user: u, ip: req.ip }, 'LOGOUT', 'user', u.sub);
  clearAuthCookies(res);
  return ok(res, null, 'تم تسجيل الخروج');
});

app.post('/api/auth/refresh', (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return fail(res, 401, 'No refresh token');
    const decoded = verifyRefreshToken(token);
    const user = store.users.get(decoded.sub);
    if (!user) return fail(res, 401, 'Invalid refresh token');
    setAuthCookies(res, user);
    return ok(res, null, 'Refreshed');
  } catch (_) {
    return fail(res, 401, 'Invalid refresh token');
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body || {};
    if (!identifier) return fail(res, 400, 'اكتب البريد أو اسم المستخدم');
    let userId = null;
    const id = store.usersByUsername.get(String(identifier).toLowerCase());
    if (id) userId = id;
    else {
      for (const [uid, u] of store.users) {
        if (u.email === String(identifier).toLowerCase()) { userId = uid; break; }
      }
    }
    if (userId) {
      const token = crypto.randomBytes(32).toString('hex');
      store.resetTokens.set(token, { userId, expiresAt: Date.now() + 60 * 60 * 1000, usedAt: null });
      console.log(`🔑 Reset link: ${process.env.APP_URL || ''}/reset-password?token=${token}`);
    }
    return ok(res, null, 'لو الحساب موجود، هتوصلك رسالة.');
  } catch (_) {
    return ok(res, null, 'لو الحساب موجود، هتوصلك رسالة.');
  }
});

app.get('/api/auth/reset-password/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return fail(res, 400, 'Token مطلوب');
  const rec = store.resetTokens.get(token);
  if (!rec) return fail(res, 400, 'الرابط غير صالح');
  if (rec.usedAt) return fail(res, 400, 'الرابط مستخدم من قبل');
  if (rec.expiresAt < Date.now()) return fail(res, 400, 'انتهت صلاحية الرابط');
  return ok(res);
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || password.length < 8) return fail(res, 400, 'بيانات غير صالحة');
    const rec = store.resetTokens.get(token);
    if (!rec) return fail(res, 400, 'الرابط غير صالح');
    if (rec.usedAt) return fail(res, 400, 'الرابط مستخدم من قبل');
    if (rec.expiresAt < Date.now()) return fail(res, 400, 'انتهت صلاحية الرابط');
    const user = store.users.get(rec.userId);
    if (!user) return fail(res, 400, 'المستخدم غير موجود');
    user.passwordHash = await hashPassword(password);
    rec.usedAt = Date.now();
    audit({ user: { sub: user.id, username: user.username }, ip: req.ip }, 'PASSWORD_RESET', 'user', user.id);
    return ok(res, null, 'تم تعيين كلمة السر');
  } catch (_) {
    return fail(res, 500, 'حدث خطأ');
  }
});

app.post('/api/auth/verify-email', (req, res) => {
  const token = req.query.token || req.body?.token;
  if (!token) return fail(res, 400, 'Token مطلوب');
  const rec = store.verifyTokens.get(token);
  if (!rec) return fail(res, 400, 'الرابط غير صالح');
  if (rec.usedAt) return fail(res, 400, 'الرابط مستخدم');
  if (rec.expiresAt < Date.now()) return fail(res, 400, 'انتهت صلاحية الرابط');
  const user = store.users.get(rec.userId);
  if (!user) return fail(res, 400, 'المستخدم غير موجود');
  user.emailVerified = true;
  rec.usedAt = Date.now();
  return ok(res, null, 'تم تأكيد البريد');
});

app.post('/api/auth/resend-verification', requireApiAuth, (req, res) => {
  const user = store.users.get(req.user.sub);
  if (!user) return fail(res, 404, 'المستخدم غير موجود');
  if (user.emailVerified) return ok(res, null, 'البريد مؤكد بالفعل');
  const token = crypto.randomBytes(32).toString('hex');
  store.verifyTokens.set(token, { userId: user.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000, usedAt: null });
  console.log(`📧 Verify link: ${process.env.APP_URL || ''}/verify-email?token=${token}`);
  return ok(res, null, 'تم الإرسال');
});

// ═════════════════════════════════════════════
//  API — Admin Auth
// ═════════════════════════════════════════════

app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, 400, 'بيانات ناقصة');
    if (username !== process.env.ADMIN_USERNAME) return fail(res, 401, 'بيانات غير صحيحة');
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) return fail(res, 500, 'Admin password not configured');
    const valid = await verifyPassword(password, hash);
    if (!valid) return fail(res, 401, 'بيانات غير صحيحة');
    const adminUser = { id: 'admin', username, role: 'SUPER_ADMIN' };
    setAuthCookies(res, adminUser);
    audit({ user: { sub: 'admin', username }, ip: req.ip }, 'ADMIN_LOGIN', 'admin', 'admin');
    return ok(res, null, 'Welcome, admin');
  } catch (err) {
    console.error('admin-login:', err.message);
    return fail(res, 500, 'حدث خطأ');
  }
});

// ═════════════════════════════════════════════
//  API — Me
// ═════════════════════════════════════════════

app.get('/api/me', requireApiAuth, (req, res) => {
  if (req.user.sub === 'admin') {
    return ok(res, { id: 'admin', username: req.user.username, role: 'SUPER_ADMIN', firstName: 'Admin', lastName: '' });
  }
  const user = store.users.get(req.user.sub);
  if (!user) return fail(res, 404, 'User not found');
  const { passwordHash, ...safe } = user;
  return ok(res, safe);
});

app.patch('/api/me', requireApiAuth, (req, res) => {
  const user = store.users.get(req.user.sub);
  if (!user) return fail(res, 404, 'User not found');
  const b = req.body || {};
  ['firstName', 'lastName', 'phone', 'email', 'gender', 'dob', 'address'].forEach((k) => {
    if (b[k] !== undefined) user[k] = b[k];
  });
  user.updatedAt = new Date().toISOString();
  audit(req, 'PROFILE_UPDATE', 'user', user.id);
  const { passwordHash, ...safe } = user;
  return ok(res, safe, 'تم الحفظ');
});

app.put('/api/me/password', requireApiAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 8) return fail(res, 400, 'بيانات غير صالحة');
    const user = store.users.get(req.user.sub);
    if (!user) return fail(res, 404, 'User not found');
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return fail(res, 401, 'كلمة السر الحالية غير صحيحة');
    user.passwordHash = await hashPassword(newPassword);
    audit(req, 'PASSWORD_CHANGE', 'user', user.id);
    return ok(res, null, 'تم تغيير كلمة السر');
  } catch (_) {
    return fail(res, 500, 'حدث خطأ');
  }
});

// ═════════════════════════════════════════════
//  API — Tests (Public catalog)
// ═════════════════════════════════════════════

app.get('/api/tests', (req, res) => {
  const { featured, limit, q, category } = req.query;
  let list = [...store.tests.values()].filter((t) => t.active !== false);
  if (featured === 'true') list = list.filter((t) => t.featured);
  if (category) list = list.filter((t) => t.category === category);
  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter((t) => (t.name || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s));
  }
  if (limit) list = list.slice(0, Number(limit) || list.length);
  return ok(res, list);
});

// ═════════════════════════════════════════════
//  API — Packages
// ═════════════════════════════════════════════

app.get('/api/packages', (req, res) => {
  const { featured, limit } = req.query;
  let list = [...store.packages.values()].filter((p) => p.active !== false);
  if (featured === 'true') list = list.filter((p) => p.featured);
  if (limit) list = list.slice(0, Number(limit) || list.length);
  return ok(res, list);
});

// ═════════════════════════════════════════════
//  API — Branches
// ═════════════════════════════════════════════

app.get('/api/branches', (req, res) => {
  const list = [...store.branches.values()].filter((b) => b.active !== false);
  return ok(res, list);
});

// ═════════════════════════════════════════════
//  API — Orders
// ═════════════════════════════════════════════

app.get('/api/orders', requireApiAuth, (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const list = [...store.orders.values()]
    .filter((o) => o.userId === req.user.sub)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  return ok(res, { items: list, total: list.length });
});

// ═════════════════════════════════════════════
//  API — Results
// ═════════════════════════════════════════════

app.get('/api/results', requireApiAuth, (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const list = [...store.results.values()]
    .filter((r) => r.userId === req.user.sub && ['READY', 'VIEWED'].includes(r.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  return ok(res, { items: list, total: list.length });
});

// ═════════════════════════════════════════════
//  API — Home Visits
// ═════════════════════════════════════════════

app.post('/api/home-visits', requireApiAuth, (req, res) => {
  try {
    const b = req.body || {};
    const { type, itemId, date, slot, phone, address, notes } = b;
    if (!type || !itemId || !date || !slot || !phone || !address) return fail(res, 400, 'كل الحقول مطلوبة');
    let itemName = '';
    if (type === 'package') itemName = store.packages.get(itemId)?.name || 'باقة';
    else itemName = store.tests.get(itemId)?.name || 'تحليل';
    const id = uuidv4();
    const visit = {
      id, visitId: 'V-' + id.slice(0, 8).toUpperCase(),
      userId: req.user.sub, patientName: req.user.username,
      type, itemId, itemName, date, slot, phone, address,
      notes: notes || '', status: 'NEW', assignedTo: null,
      createdAt: new Date().toISOString(),
    };
    store.homeVisits.set(id, visit);
    audit(req, 'HOME_VISIT_CREATE', 'homeVisit', id);
    return ok(res, visit, 'تم استلام طلبك');
  } catch (_) {
    return fail(res, 500, 'حدث خطأ');
  }
});

app.get('/api/home-visits', requireApiAuth, (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const list = [...store.homeVisits.values()]
    .filter((v) => v.userId === req.user.sub)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  return ok(res, { items: list, total: list.length });
});

// ═════════════════════════════════════════════
//  API — Points
// ═════════════════════════════════════════════

app.get('/api/points', requireApiAuth, (req, res) => {
  const data = store.points.get(req.user.sub) || {
    balance: 0, totalEarned: 0, totalRedeemed: 0, transactions: [], updatedAt: new Date().toISOString(),
  };
  return ok(res, data);
});

// ═════════════════════════════════════════════
//  API — Notifications
// ═════════════════════════════════════════════

app.get('/api/notifications', requireApiAuth, (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const all = [...store.notifications.values()]
    .filter((n) => n.userId === req.user.sub)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);
  return ok(res, { items, total: all.length });
});

app.patch('/api/notifications/:id/read', requireApiAuth, (req, res) => {
  const n = store.notifications.get(req.params.id);
  if (!n || n.userId !== req.user.sub) return fail(res, 404, 'Not found');
  n.read = true;
  return ok(res, n);
});

app.patch('/api/notifications/read-all', requireApiAuth, (req, res) => {
  for (const n of store.notifications.values()) {
    if (n.userId === req.user.sub) n.read = true;
  }
  return ok(res);
});

// ═════════════════════════════════════════════
//  ADMIN — Dashboard
// ═════════════════════════════════════════════

app.get('/api/admin/dashboard', requireApiAdmin, (req, res) => {
  const totalPatients = store.users.size;
  const totalOrders = store.orders.size;
  const pendingResults = [...store.results.values()].filter((r) => r.status === 'PROCESSING').length;
  const completedResults = [...store.results.values()].filter((r) => ['READY', 'VIEWED', 'VERIFIED', 'PUBLISHED'].includes(r.status)).length;
  const homeVisits = store.homeVisits.size;
  const revenue = [...store.orders.values()].reduce((s, o) => s + (Number(o.finalPrice) || 0), 0);
  const newUsers = [...store.users.values()].filter((u) => {
    const d = new Date(u.createdAt).getTime();
    return Date.now() - d < 30 * 24 * 60 * 60 * 1000;
  }).length;
  const activeTests = [...store.tests.values()].filter((t) => t.active !== false).length;

  const byStatus = {};
  for (const o of store.orders.values()) {
    byStatus[o.status || 'PENDING'] = (byStatus[o.status || 'PENDING'] || 0) + 1;
  }
  const ordersByStatus = Object.entries(byStatus).map(([status, count]) => ({ status, count }));

  return ok(res, {
    stats: { totalPatients, totalOrders, pendingResults, completedResults, homeVisits, revenue, newUsers, activeTests },
    ordersByStatus,
  });
});

// ═════════════════════════════════════════════
//  ADMIN — Patients
// ═════════════════════════════════════════════

app.get('/api/admin/patients', requireApiAdmin, (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let list = [...store.users.values()];
  if (q) {
    list = list.filter((u) =>
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  }
  const safe = list.map(({ passwordHash, ...u }) => u);
  return ok(res, { items: safe, total: safe.length });
});

app.post('/api/admin/patients', requireApiAdmin, async (req, res) => {
  try {
    const { firstName, lastName, username, password, phone, email } = req.body || {};
    if (!firstName || !lastName || !username || !password) return fail(res, 400, 'بيانات ناقصة');
    if (password.length < 8) return fail(res, 400, 'كلمة السر قصيرة');
    const uname = String(username).toLowerCase();
    if (store.usersByUsername.has(uname)) return fail(res, 409, 'اسم المستخدم مستخدم');
    const id = uuidv4();
    const user = {
      id, firstName, lastName, username: uname,
      phone: phone || '', email: (email || '').toLowerCase(),
      passwordHash: await hashPassword(password),
      role: 'PATIENT', active: true, emailVerified: false,
      createdAt: new Date().toISOString(),
      createdBy: req.user.sub,
    };
    store.users.set(id, user);
    store.usersByUsername.set(uname, id);
    store.points.set(id, { balance: 0, totalEarned: 0, totalRedeemed: 0, transactions: [], updatedAt: new Date().toISOString() });
    audit(req, 'PATIENT_CREATE', 'user', id);
    return ok(res, { id, username: uname }, 'تم إنشاء المريض');
  } catch (_) {
    return fail(res, 500, 'حدث خطأ');
  }
});

app.patch('/api/admin/patients/:id', requireApiAdmin, (req, res) => {
  const u = store.users.get(req.params.id);
  if (!u) return fail(res, 404, 'المريض غير موجود');
  const b = req.body || {};
  ['firstName', 'lastName', 'phone', 'email', 'active'].forEach((k) => {
    if (b[k] !== undefined) u[k] = b[k];
  });
  audit(req, 'PATIENT_UPDATE', 'user', u.id);
  const { passwordHash, ...safe } = u;
  return ok(res, safe, 'تم التحديث');
});

app.delete('/api/admin/patients/:id', requireApiAdmin, (req, res) => {
  const u = store.users.get(req.params.id);
  if (!u) return fail(res, 404, 'المريض غير موجود');
  u.active = false;
  audit(req, 'PATIENT_DISABLE', 'user', u.id);
  return ok(res, null, 'تم تعطيل الحساب');
});

// ═════════════════════════════════════════════
//  ADMIN — Tests
// ═════════════════════════════════════════════

app.get('/api/admin/tests', requireApiAdmin, (req, res) => ok(res, { items: [...store.tests.values()] }));

app.post('/api/admin/tests', requireApiAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.name || b.price == null) return fail(res, 400, 'الاسم والسعر مطلوبان');
  const id = b.id || uuidv4();
  const t = { id, ...b, price: Number(b.price), active: b.active !== false, createdAt: new Date().toISOString() };
  store.tests.set(id, t);
  audit(req, 'TEST_CREATE', 'test', id);
  return ok(res, t, 'تمت الإضافة');
});

app.patch('/api/admin/tests/:id', requireApiAdmin, (req, res) => {
  const t = store.tests.get(req.params.id);
  if (!t) return fail(res, 404, 'التحليل غير موجود');
  Object.assign(t, req.body || {});
  if (req.body?.price != null) t.price = Number(req.body.price);
  audit(req, 'TEST_UPDATE', 'test', t.id);
  return ok(res, t, 'تم التحديث');
});

app.delete('/api/admin/tests/:id', requireApiAdmin, (req, res) => {
  const t = store.tests.get(req.params.id);
  if (!t) return fail(res, 404, 'التحليل غير موجود');
  t.active = false;
  audit(req, 'TEST_DISABLE', 'test', t.id);
  return ok(res, null, 'تم التعطيل');
});

// ═════════════════════════════════════════════
//  ADMIN — Packages
// ═════════════════════════════════════════════

app.get('/api/admin/packages', requireApiAdmin, (req, res) => ok(res, { items: [...store.packages.values()] }));

app.post('/api/admin/packages', requireApiAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.name || b.price == null) return fail(res, 400, 'الاسم والسعر مطلوبان');
  const id = b.id || uuidv4();
  const p = { id, ...b, price: Number(b.price), active: b.active !== false, createdAt: new Date().toISOString() };
  store.packages.set(id, p);
  audit(req, 'PACKAGE_CREATE', 'package', id);
  return ok(res, p, 'تمت الإضافة');
});

app.patch('/api/admin/packages/:id', requireApiAdmin, (req, res) => {
  const p = store.packages.get(req.params.id);
  if (!p) return fail(res, 404, 'الباقة غير موجودة');
  Object.assign(p, req.body || {});
  if (req.body?.price != null) p.price = Number(req.body.price);
  audit(req, 'PACKAGE_UPDATE', 'package', p.id);
  return ok(res, p, 'تم التحديث');
});

app.delete('/api/admin/packages/:id', requireApiAdmin, (req, res) => {
  const p = store.packages.get(req.params.id);
  if (!p) return fail(res, 404, 'الباقة غير موجودة');
  p.active = false;
  audit(req, 'PACKAGE_DISABLE', 'package', p.id);
  return ok(res, null, 'تم التعطيل');
});

// ═════════════════════════════════════════════
//  ADMIN — Orders
// ═════════════════════════════════════════════

app.get('/api/admin/orders', requireApiAdmin, (req, res) => {
  const list = [...store.orders.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, { items: list, total: list.length });
});

app.patch('/api/admin/orders/:id', requireApiAdmin, (req, res) => {
  const o = store.orders.get(req.params.id);
  if (!o) return fail(res, 404, 'الطلب غير موجود');
  Object.assign(o, req.body || {});
  audit(req, 'ORDER_UPDATE', 'order', o.id);
  return ok(res, o, 'تم التحديث');
});

app.delete('/api/admin/orders/:id', requireApiAdmin, (req, res) => {
  const o = store.orders.get(req.params.id);
  if (!o) return fail(res, 404, 'الطلب غير موجود');
  o.status = 'CANCELLED';
  audit(req, 'ORDER_CANCEL', 'order', o.id);
  return ok(res, null, 'تم الإلغاء');
});

// ═════════════════════════════════════════════
//  ADMIN — Results
// ═════════════════════════════════════════════

app.get('/api/admin/results', requireApiAdmin, (req, res) => {
  const list = [...store.results.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, { items: list, total: list.length });
});

app.post('/api/admin/results', requireApiAdmin, (req, res) => {
  const b = req.body || {};
  const id = uuidv4();
  const r = {
    id,
    orderId: b.orderId || null,
    userId: b.userId || null,
    patientName: b.patientName || '',
    title: b.title || 'نتيجة تحليل',
    items: b.items || [],
    status: b.status || 'DRAFT',
    pdfUrl: b.pdfUrl || null,
    createdAt: new Date().toISOString(),
    createdBy: req.user.sub,
  };
  store.results.set(id, r);
  audit(req, 'RESULT_CREATE', 'result', id);
  return ok(res, r, 'تم الإنشاء');
});

app.patch('/api/admin/results/:id', requireApiAdmin, (req, res) => {
  const r = store.results.get(req.params.id);
  if (!r) return fail(res, 404, 'النتيجة غير موجودة');
  Object.assign(r, req.body || {});
  if (r.status === 'PUBLISHED' && !r.publishedAt) r.publishedAt = new Date().toISOString();
  audit(req, 'RESULT_UPDATE', 'result', r.id);
  return ok(res, r, 'تم التحديث');
});

app.delete('/api/admin/results/:id', requireApiAdmin, (req, res) => {
  const r = store.results.get(req.params.id);
  if (!r) return fail(res, 404, 'النتيجة غير موجودة');
  store.results.delete(req.params.id);
  audit(req, 'RESULT_DELETE', 'result', req.params.id);
  return ok(res, null, 'تم الحذف');
});

// ═════════════════════════════════════════════
//  ADMIN — Home Visits
// ═════════════════════════════════════════════

app.get('/api/admin/home-visits', requireApiAdmin, (req, res) => {
  const list = [...store.homeVisits.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, { items: list, total: list.length });
});

app.patch('/api/admin/home-visits/:id', requireApiAdmin, (req, res) => {
  const v = store.homeVisits.get(req.params.id);
  if (!v) return fail(res, 404, 'الزيارة غير موجودة');
  Object.assign(v, req.body || {});
  audit(req, 'HOME_VISIT_UPDATE', 'homeVisit', v.id);
  return ok(res, v, 'تم التحديث');
});

app.delete('/api/admin/home-visits/:id', requireApiAdmin, (req, res) => {
  const v = store.homeVisits.get(req.params.id);
  if (!v) return fail(res, 404, 'الزيارة غير موجودة');
  v.status = 'CANCELLED';
  audit(req, 'HOME_VISIT_CANCEL', 'homeVisit', v.id);
  return ok(res, null, 'تم الإلغاء');
});

// ═════════════════════════════════════════════
//  ADMIN — Branches
// ═════════════════════════════════════════════

app.get('/api/admin/branches', requireApiAdmin, (req, res) => ok(res, { items: [...store.branches.values()] }));

app.post('/api/admin/branches', requireApiAdmin, (req, res) => {
  const b = req.body || {};
  if (!b.name) return fail(res, 400, 'اسم الفرع مطلوب');
  const id = b.id || uuidv4();
  const br = { id, ...b, active: b.active !== false, createdAt: new Date().toISOString() };
  store.branches.set(id, br);
  audit(req, 'BRANCH_CREATE', 'branch', id);
  return ok(res, br, 'تمت الإضافة');
});

app.patch('/api/admin/branches/:id', requireApiAdmin, (req, res) => {
  const br = store.branches.get(req.params.id);
  if (!br) return fail(res, 404, 'الفرع غير موجود');
  Object.assign(br, req.body || {});
  audit(req, 'BRANCH_UPDATE', 'branch', br.id);
  return ok(res, br, 'تم التحديث');
});

app.delete('/api/admin/branches/:id', requireApiAdmin, (req, res) => {
  const br = store.branches.get(req.params.id);
  if (!br) return fail(res, 404, 'الفرع غير موجود');
  br.active = false;
  audit(req, 'BRANCH_DISABLE', 'branch', br.id);
  return ok(res, null, 'تم التعطيل');
});

// ═════════════════════════════════════════════
//  ADMIN — Points
// ═════════════════════════════════════════════

app.get('/api/admin/points', requireApiAdmin, (req, res) => {
  const items = [];
  for (const [uid, p] of store.points) {
    const u = store.users.get(uid);
    items.push({
      id: uid,
      patientName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : uid,
      balance: p.balance || 0,
      totalEarned: p.totalEarned || 0,
      totalRedeemed: p.totalRedeemed || 0,
    });
  }
  return ok(res, { items, total: items.length });
});

app.post('/api/admin/points/:userId/adjust', requireApiAdmin, (req, res) => {
  const { points, reason } = req.body || {};
  const n = Number(points);
  if (!Number.isFinite(n) || n === 0) return fail(res, 400, 'قيمة غير صالحة');
  const p = store.points.get(req.params.userId) || { balance: 0, totalEarned: 0, totalRedeemed: 0, transactions: [] };
  p.balance = (p.balance || 0) + n;
  if (n > 0) p.totalEarned = (p.totalEarned || 0) + n;
  else p.totalRedeemed = (p.totalRedeemed || 0) + Math.abs(n);
  p.transactions = p.transactions || [];
  p.transactions.unshift({ id: uuidv4(), type: n > 0 ? 'ADJUST' : 'REDEEM', points: n, reason: reason || 'تعديل إداري', createdAt: new Date().toISOString() });
  p.updatedAt = new Date().toISOString();
  store.points.set(req.params.userId, p);
  audit(req, 'POINTS_ADJUST', 'user', req.params.userId, { points: n });
  return ok(res, p, 'تم التعديل');
});

// ═════════════════════════════════════════════
//  ADMIN — Staff
// ═════════════════════════════════════════════

app.get('/api/admin/staff', requireApiAdmin, (req, res) => {
  const list = [...store.users.values()].filter((u) => u.role && u.role !== 'PATIENT');
  const safe = list.map(({ passwordHash, ...u }) => u);
  return ok(res, { items: safe, total: safe.length });
});

// ═════════════════════════════════════════════
//  ADMIN — Reports
// ═════════════════════════════════════════════

app.get('/api/admin/reports', requireApiAdmin, (req, res) => {
  const revenue = [...store.orders.values()].reduce((s, o) => s + (Number(o.finalPrice) || 0), 0);
  return ok(res, {
    revenue,
    orders: store.orders.size,
    patients: store.users.size,
    homeVisits: store.homeVisits.size,
  });
});

// ═════════════════════════════════════════════
//  ADMIN — Audit Logs
// ═════════════════════════════════════════════

app.get('/api/admin/audit-logs', requireApiAdmin, (req, res) => {
  return ok(res, { items: store.auditLogs.slice(0, 200), total: store.auditLogs.length });
});

// ═════════════════════════════════════════════
//  ADMIN — Settings
// ═════════════════════════════════════════════

app.get('/api/admin/settings', requireApiAdmin, (req, res) => ok(res, store.settings));

app.put('/api/admin/settings', requireApiAdmin, (req, res) => {
  Object.assign(store.settings, req.body || {});
  audit(req, 'SETTINGS_UPDATE', 'settings', null);
  return ok(res, store.settings, 'تم الحفظ');
});

// ═════════════════════════════════════════════
//  Fallbacks
// ═════════════════════════════════════════════

app.use('/api', (req, res) => fail(res, 404, 'API endpoint not found'));

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = IS_PROD && status === 500 ? 'Something went wrong' : (err.message || 'Error');
  if (status >= 500) console.error('💥', err);
  res.status(status).json({ success: false, message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Value Lab running on http://localhost:${PORT}`);
    console.log(`   ENV: ${process.env.NODE_ENV}`);
  });
}

module.exports = app;
