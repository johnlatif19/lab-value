/* =========================================================
   Value Lab — Forgot Password Script
   ========================================================= */

(function () {
  'use strict';

  const form = document.getElementById('forgotForm');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');
  const successBlock = document.getElementById('successBlock');

  if (!form) return;

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة';
  }

  // ============ Validation ============
  function validate(identifier) {
    if (!identifier || identifier.length < 3) {
      return 'اكتب البريد الإلكتروني أو اسم المستخدم';
    }
    // لو فيه @ → نتأكد إنه إيميل صحيح
    if (identifier.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      return 'البريد الإلكتروني غير صحيح';
    }
    return null;
  }

  // ============ Submit ============
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');

    const identifier = form.identifier.value.trim();

    const error = validate(identifier);
    if (error) return setMsg(error, 'error');

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ identifier }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'تعذّر إرسال الرابط، حاول تاني');
      }

      // نخفي الفورم ونعرض رسالة النجاح
      // (بنعرض نفس الرسالة سواء الإيميل موجود أو لأ — لأسباب أمنية)
      form.classList.add('hidden');
      successBlock.classList.remove('hidden');
    } catch (err) {
      setMsg(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      setLoading(false);
    }
  });

})();