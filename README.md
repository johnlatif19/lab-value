# Value Lab — فاليو لاب

منصة إدارة معمل تحاليل طبية: موقع للمرضى + لوحة تحكم للإدارة.
مبنية على Node.js + Express + Firebase + Cloudinary + SMTP.

---

## ✨ المميزات

### موقع المريض
- تسجيل حساب / تسجيل دخول
- تصفح التحاليل والباقات والأسعار
- عرض النتائج (بعد اعتمادها فقط)
- حجز زيارة منزلية
- برنامج النقاط والولاء

### لوحة الإدارة
- تسجيل دخول آمن
- Dashboard بإحصائيات ورسوم
- إدارة المرضى، الطلبات، النتائج، التحاليل، الباقات، الفروع، الموظفين، النقاط

---

## 🧱 المتطلبات

- Node.js >= 20
- حساب Firebase (Firestore + Storage)
- حساب Cloudinary
- SMTP (اختياري للتطوير)

---

## ⚙️ التشغيل المحلي

```bash
# 1) استنسخ المشروع
git clone <repo-url>
cd value-lab

# 2) ثبّت الحزم
npm install

# 3) انسخ ملف البيئة
cp .env.example .env
# ثم املأ القيم: JWT_SECRET, SESSION_SECRET, CSRF_SECRET, Firebase, Cloudinary...

# 4) شغّل السيرفر
npm run dev
```

افتح: http://localhost:3000

---

## 🔐 متغيرات البيئة المطلوبة

| المتغير | الوصف |
|---|---|
| `NODE_ENV` | `development` أو `production` |
| `PORT` | بورت السيرفر المحلي (افتراضي 3000) |
| `APP_URL` | رابط التطبيق |
| `ADMIN_USERNAME` | اسم مستخدم الأدمن |
| `ADMIN_PASSWORD_HASH` | Argon2id hash لكلمة سر الأدمن |
| `JWT_SECRET` | سر توقيع الـJWT (64 حرف عشوائي) |
| `JWT_ACCESS_EXPIRES` | مدة صلاحية access token |
| `JWT_REFRESH_EXPIRES` | مدة صلاحية refresh token |
| `SESSION_SECRET` | سر الـsession |
| `CSRF_SECRET` | سر CSRF |
| `FIREBASE_CONFIG` | إعدادات Firebase العامة (JSON) |
| `FIREBASE_PROJECT_ID` | معرّف مشروع Firebase |
| `FIREBASE_CLIENT_EMAIL` | بريد خدمة Firebase |
| `FIREBASE_PRIVATE_KEY` | مفتاح Firebase الخاص |
| `FIREBASE_STORAGE_BUCKET` | Bucket التخزين |
| `CLOUDINARY_*` | إعدادات Cloudinary |
| `SMTP_*` | إعدادات SMTP |

> ⚠️ **لا ترفع `.env` على git أبدًا.**

---

## 🧪 توليد الأسرار

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

شغّلها 3 مرات → JWT_SECRET, SESSION_SECRET, CSRF_SECRET.

---

## 🚀 النشر على Vercel

1. ارفع المشروع على GitHub.
2. استورد الـrepo في Vercel.
3. أضف متغيرات البيئة من **Project Settings → Environment Variables**.
4. Deploy.

`vercel.json` جاهز لتوجيه:
- `/api/*` → `server.js`
- `/auth/*` → `public/auth/*`
- الباقي → `public/*`

---

## 📁 هيكل المشروع

```
value-lab/
├── public/         # الموقع والـfrontend
│   └── auth/       # لوحة الإدارة
├── src/            # الـbackend
│   ├── config/
│   ├── utils/
│   ├── middleware/
│   ├── services/
│   └── routes/
├── server.js
├── vercel.json
├── package.json
└── .env
```

---

## 🔒 ملاحظات أمنية

- كلمات المرور مخزنة بـArgon2id.
- JWT في cookies فقط (httpOnly + secure في production).
- Rate limiting على `/api/auth/*`.
- Helmet + HPP + CORS مقيد.
- لا يتم إرجاع stack traces في production.
- Audit logs لكل العمليات الحساسة (لاحقًا).

---

## 📞 التواصل

Value Lab — فاليو لاب
© 2026 — جميع الحقوق محفوظة.