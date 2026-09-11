/* =========================================================
   Value Lab — Sign Up Script
   ========================================================= */

(function () {
  'use strict';

  const form = document.getElementById('signupForm');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) return;

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب';
  }

  // ============ Client-side validation ============
  function validate(data) {
    if (!data.firstName || data.firstName.length < 2) return 'الاسم الأول مطلوب';
    if (!data.lastName || data.lastName.length < 2) return 'اسم العائلة مطلوب';
    if (!/^[a-zA-Z0-9_\.]{3,30}$/.test(data.username)) {
      return 'اسم المستخدم: 3-30 حرف إنجليزي/أرقام/_/. فقط';
    }
    if (!/^[0-9+\-\s]{8,20}$/.test(data.phone)) return 'رقم الهاتف غير صحيح';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'البريد الإلكتروني غير صحيح';
    if (!data.password || data.password.length < 8) return 'كلمة السر 8 أحرف على الأقل';
    if (data.password !== data.confirmPassword) return 'كلمتا السر غير متطابقتين';
    if (!data.gender) return 'النوع مطلوب';
    if (!data.dob) return 'تاريخ الميلاد مطلوب';
    if (!data.city) return 'المدينة مطلوبة';
    if (!data.area) return 'المنطقة مطلوبة';
    if (!data.street) return 'الشارع مطلوب';
    if (!data.building) return 'رقم المبنى مطلوب';
    if (!data.apartment) return 'رقم الشقة مطلوب';
    if (!data.floor) return 'الطابق مطلوب';
    if (!data.terms) return 'يجب الموافقة على الشروط والأحكام';
    return null;
  }

  // ============ Submit ============
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');

    const data = {
      firstName: form.firstName.value.trim(),
      lastName: form.lastName.value.trim(),
      username: form.username.value.trim().toLowerCase(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      password: form.password.value,
      confirmPassword: form.confirmPassword.value,
      gender: form.gender.value,
      dob: form.dob.value,
      city: form.city.value.trim(),
      area: form.area.value.trim(),
      street: form.street.value.trim(),
      building: form.building.value.trim(),
      apartment: form.apartment.value.trim(),
      floor: form.floor.value.trim(),
      terms: form.terms.checked,
    };

    const error = validate(data);
    if (error) {
      setMsg(error, 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          username: data.username,
          phone: data.phone,
          email: data.email,
          password: data.password,
          gender: data.gender,
          dob: data.dob,
          address: {
            city: data.city,
            area: data.area,
            street: data.street,
            building: data.building,
            apartment: data.apartment,
            floor: data.floor,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'فشل إنشاء الحساب، حاول مرة أخرى');
      }

      setMsg('تم إنشاء الحساب بنجاح، جارٍ تحويلك لتسجيل الدخول...', 'ok');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1300);

    } catch (err) {
      setMsg(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      setLoading(false);
    }
  });

  // ============ Live password match ============
  const pwd = form.password;
  const confirmPwd = form.confirmPassword;

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
  pwd.addEventListener('input', checkMatch);
  confirmPwd.addEventListener('input', checkMatch);

})();