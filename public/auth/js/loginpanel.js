/* =========================================================
   Value Lab — Admin Login Script
   ========================================================= */

(function () {
  'use strict';

  const form = document.getElementById('adminLoginForm');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) return;

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'جارٍ الدخول...' : 'دخول';
  }

  // ============ Validation ============
  function validate(data) {
    if (!data.username || data.username.length < 3) {
      return 'اسم المستخدم مطلوب (3 أحرف على الأقل)';
    }
    if (!data.password || data.password.length < 8) {
      return 'كلمة السر يجب أن تكون 8 أحرف على الأقل';
    }
    return null;
  }

  // ============ Submit ============
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');

    const data = {
      username: form.username.value.trim(),
      password: form.password.value,
    };

    const error = validate(data);
    if (error) {
      setMsg(error, 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(data),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'بيانات الدخول غير صحيحة');
      }

      setMsg('تم الدخول بنجاح، جارٍ التحويل...', 'ok');
      setTimeout(() => {
        window.location.href = '/auth/dashboard';
      }, 700);

    } catch (err) {
      setMsg(err.message || 'حدث خطأ غير متوقع', 'error');
      // Clear password on failure for security
      form.password.value = '';
      form.password.focus();
    } finally {
      setLoading(false);
    }
  });

})();