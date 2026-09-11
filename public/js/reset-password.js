/* =========================================================
   Value Lab — Reset Password Script
   ========================================================= */

(function () {
  'use strict';

  const loadingBlock = document.getElementById('loadingBlock');
  const errorBlock = document.getElementById('errorBlock');
  const errorText = document.getElementById('errorText');
  const formBlock = document.getElementById('formBlock');
  const successBlock = document.getElementById('successBlock');

  const form = document.getElementById('resetForm');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');
  const strengthBar = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');

  // ============ Get token from URL ============
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  function show(block) {
    [loadingBlock, errorBlock, formBlock, successBlock].forEach((b) => {
      if (b) b.classList.add('hidden');
    });
    block?.classList.remove('hidden');
  }

  // ============ Verify token on load ============
  async function verifyToken() {
    if (!token) {
      errorText.textContent = 'الرابط اللي فتحته مش فيه token صالح. اطلب رابط جديد.';
      show(errorBlock);
      return;
    }

    try {
      const res = await fetch(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        errorText.textContent = json.message || 'الرابط غير صالح أو انتهت صلاحيته.';
        show(errorBlock);
        return;
      }

      // الرابط صالح → اعرض الفورم
      show(formBlock);
    } catch (_) {
      errorText.textContent = 'تعذّر التحقق من الرابط. حاول تاني.';
      show(errorBlock);
    }
  }

  // ============ Password strength ============
  function checkStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    strengthBar.className = 'strength' + (pwd ? ` level-${score}` : '');

    const labels = {
      0: 'لازم 8 أحرف على الأقل.',
      1: 'ضعيفة — أضف حروف كبيرة/أرقام.',
      2: 'مقبولة — ممكن تكون أقوى.',
      3: 'جيدة.',
      4: 'قوية جدًا.',
    };
    strengthText.textContent = labels[score] || '';
    return score;
  }

  form?.password?.addEventListener('input', (e) => {
    checkStrength(e.target.value);
  });

  // ============ Live match check ============
  const pwd = form?.password;
  const confirmPwd = form?.confirmPassword;
  function checkMatch() {
    if (!confirmPwd.value) {
      confirmPwd.setCustomValidity('');
      return;
    }
    if (pwd.value !== confirmPwd.value) {
      confirmPwd.setCustomValidity('كلمتا السر غير متطابقتين');
    } else {
      confirmPwd.setCustomValidity('');
    }
  }
  pwd?.addEventListener('input', checkMatch);
  confirmPwd?.addEventListener('input', checkMatch);

  // ============ Submit ============
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'msg';

    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (!password || password.length < 8) {
      msg.textContent = 'كلمة السر لازم 8 أحرف على الأقل';
      msg.className = 'msg error';
      return;
    }
    if (password !== confirmPassword) {
      msg.textContent = 'كلمتا السر غير متطابقتين';
      msg.className = 'msg error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ التعيين...';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'تعذّر تعيين كلمة السر');
      }

      // نجاح → اعرض رسالة النجاح
      show(successBlock);

      // تحويل تلقائي لـ login بعد 2.5 ثانية
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (err) {
      msg.textContent = err.message || 'حدث خطأ غير متوقع';
      msg.className = 'msg error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'تعيين كلمة السر';
    }
  });

  // ============ Init ============
  document.addEventListener('DOMContentLoaded', verifyToken);

})();