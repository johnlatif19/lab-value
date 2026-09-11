/* =========================================================
   Value Lab — Frontend Page Auth Guard
   ─────────────────────────────────────────────
   الاستخدام: <script src="/public/js/core/auth-guard.js"></script>
   قبل أي سكربت تاني في الصفحة.

   بيشتغل بالشكل ده:
   1. يخفي الـbody لحد ما يتأكد المستخدم مسجل.
   2. ينادي /api/me.
   3. لو 401/403 → يحوّل لـ/login فورًا.
   4. لو تمام → يخزّن بيانات المستخدم في window.__VL_USER.
   5. يفتح الصفحة.

   ملاحظة: ده حماية على مستوى الـfrontend فقط.
   الحماية الحقيقية في server.js عبر requirePageAuth.
   ========================================================= */

(function () {
  'use strict';

  // أخفي المحتوى لحد ما نتأكد
  document.documentElement.style.visibility = 'hidden';

  // لو الصفحة بتاخد وقت، نعرض مؤشر تحميل بسيط
  function showLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.id = '__vl_guard_overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0',
      'background:#1a222c',
      'display:flex', 'align-items:center', 'justify-content:center',
      'z-index:99999',
      'font-family:system-ui,sans-serif',
      'color:#8b98a8',
      'font-size:14px',
    ].join(';');
    overlay.innerHTML = `
      <div style="text-align:center;">
        <div style="width:36px;height:36px;border:3px solid #2c3742;border-top-color:#6f96b3;border-radius:50%;margin:0 auto 12px;animation:__vl_spin .8s linear infinite;"></div>
        <div>جارٍ التحقق...</div>
      </div>
      <style>@keyframes __vl_spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(overlay);
  }

  function removeLoadingOverlay() {
    const el = document.getElementById('__vl_guard_overlay');
    if (el) el.remove();
  }

  function reveal() {
    document.documentElement.style.visibility = '';
    removeLoadingOverlay();
  }

  function redirectToLogin() {
    // نستخدم replace عشان ماينفعش "back" يرجع للصفحة المحمية
    window.location.replace('/login');
  }

  async function checkAuth() {
    // أظهر overlay بس في حالة إن الصفحة اتأخرت
    const t = setTimeout(showLoadingOverlay, 150);

    try {
      const res = await fetch('/api/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });

      clearTimeout(t);

      if (res.status === 401 || res.status === 403) {
        redirectToLogin();
        return;
      }

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        redirectToLogin();
        return;
      }

      // خزّن بيانات المستخدم للاستخدام السريع في الصفحة
      window.__VL_USER = json.data || {};

      // لو الصفحة أدمن، نتأكد من الـrole
      // (بس الحماية الحقيقية في السيرفر)
      // نترك الصفحة تقرر لو محتاجة فحص إضافي.

      reveal();
    } catch (_) {
      clearTimeout(t);
      redirectToLogin();
    }
  }

  // ابدأ التحقق فورًا (مش محتاج DOMContentLoaded لأننا بنخفي الـbody)
  checkAuth();

  // Helper عام: للصفحات اللي محتاجة تتحقق إن المستخدم أدمن
  window.VLRequireAdmin = function () {
    const u = window.__VL_USER || {};
    const role = (u.role || '').toUpperCase();
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'LAB_MANAGER') {
      window.location.replace('/auth/loginpanel');
      return false;
    }
    return true;
  };

})();