/* =========================================================
   Value Lab — Verify Email Script
   ========================================================= */

(function () {
  'use strict';

  const loadingBlock = document.getElementById('loadingBlock');
  const successBlock = document.getElementById('successBlock');
  const errorBlock = document.getElementById('errorBlock');
  const errorTitle = document.getElementById('errorTitle');
  const errorText = document.getElementById('errorText');
  const pendingBlock = document.getElementById('pendingBlock');
  const resendBtn = document.getElementById('resendBtn');
  const resendMsg = document.getElementById('resendMsg');

  function show(block) {
    [loadingBlock, successBlock, errorBlock, pendingBlock].forEach((b) => {
      if (b) b.classList.add('hidden');
    });
    block?.classList.remove('hidden');
  }

  function setResendMsg(text, type) {
    resendMsg.textContent = text || '';
    resendMsg.className = 'msg' + (type ? ' ' + type : '');
  }

  // ============ Get token from URL ============
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  // ============ Verify token if exists ============
  async function verifyToken() {
    // لو مفيش token → حالة "pending"
    if (!token) {
      show(pendingBlock);
      return;
    }

    try {
      const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        const msg = json.message || 'الرابط غير صالح أو انتهت صلاحيته.';
        errorText.textContent = msg;

        // لو الحساب متأكد بالفعل → نعرض حالة نجاح مختلفة
        if (/already/i.test(msg) || /verified/i.test(msg)) {
          errorTitle.textContent = 'مؤكد بالفعل';
          errorText.textContent = 'بريدك الإلكتروني مؤكد من قبل. يمكنك تسجيل الدخول مباشرة.';
        }

        show(errorBlock);
        return;
      }

      // نجاح → عرض رسالة + تحويل تلقائي
      show(successBlock);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (_) {
      errorText.textContent = 'تعذّر التحقق من الرابط. حاول تاني.';
      show(errorBlock);
    }
  }

  // ============ Resend verification link ============
  resendBtn?.addEventListener('click', async () => {
    setResendMsg('');
    resendBtn.disabled = true;
    resendBtn.textContent = 'جارٍ الإرسال...';

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'تعذّر إرسال الرابط');
      }

      setResendMsg('تم إرسال رابط جديد على بريدك.', 'ok');
    } catch (err) {
      setResendMsg(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = 'إعادة إرسال الرابط';
    }
  });

  // ============ Init ============
  document.addEventListener('DOMContentLoaded', verifyToken);

})();