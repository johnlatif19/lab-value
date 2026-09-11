/* =========================================================
   Value Lab — Firebase Admin (Firestore)
   ─────────────────────────────────────────────
   يقرأ FIREBASE_CONFIG من .env كـJSON string فيه
   service account credentials كاملة (project_id, private_key, ...).

   - التهيئة تتم مرة واحدة فقط (lazy + cached).
   - لو الإعدادات ناقصة، ما يرميش خطأ — بس بيسجل warning.
   - private_key يتم تحويل \n النصية إلى newlines حقيقية.

   الاستخدام:
     const { initFirebase, getDb, getBucket } = require('./src/config/firebase');
     initFirebase();           // في أول server.js
     const db = getDb();       // في أي مكان
   ========================================================= */

const admin = require('firebase-admin');

let initialized = false;
let db = null;
let bucket = null;

/**
 * يقرأ FIREBASE_CONFIG من .env ويحوّله لكائن JSON
 * @returns {object|null}
 */
function parseConfig() {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw) return null;

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Firebase Admin SDK بيتوقع newlines حقيقية في private_key
    if (parsed && typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }

    // تأكد من الحقول الأساسية
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.error('❌ FIREBASE_CONFIG missing required fields (project_id, client_email, private_key)');
      return null;
    }

    return parsed;
  } catch (err) {
    console.error('❌ FIREBASE_CONFIG is not valid JSON:', err.message);
    return null;
  }
}

/**
 * يهيّئ Firebase Admin SDK مرة واحدة.
 * @returns {{ db: FirebaseFirestore.Firestore|null, bucket: object|null }}
 */
function initFirebase() {
  if (initialized) return { db, bucket };

  const config = parseConfig();
  if (!config) {
    console.warn('⚠️  FIREBASE_CONFIG missing or invalid — Firestore disabled.');
    initialized = true;
    return { db: null, bucket: null };
  }

  try {
    // لو التطبيق اتهيأ بالفعل (مثلاً serverless cold start + hot reload)
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(config),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
      });
    }

    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });

    if (process.env.FIREBASE_STORAGE_BUCKET) {
      bucket = admin.storage().bucket();
    }

    initialized = true;
    console.log('✅ Firestore initialized:', config.project_id);
    return { db, bucket };
  } catch (err) {
    console.error('❌ Firebase init failed:', err.message);
    initialized = true;
    return { db: null, bucket: null };
  }
}

/**
 * يرجّع Firestore instance (مع التهيئة التلقائية عند أول استدعاء)
 * @returns {FirebaseFirestore.Firestore|null}
 */
function getDb() {
  if (!initialized) initFirebase();
  return db;
}

/**
 * يرجّع Storage bucket (مع التهيئة التلقائية)
 * @returns {object|null}
 */
function getBucket() {
  if (!initialized) initFirebase();
  return bucket;
}

module.exports = {
  initFirebase,
  getDb,
  getBucket,
  admin,
};