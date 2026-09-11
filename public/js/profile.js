/* =========================================================
   Value Lab — Profile Script
   ========================================================= */

(function () {
  'use strict';

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const logoutBtn = document.getElementById('logoutBtn');

  const tabs = document.querySelectorAll('.tab');
  const sections = document.querySelectorAll('.section');

  const infoForm = document.getElementById('infoForm');
  const infoMsg = document.getElementById('infoMsg');
  const infoBtn = document.getElementById('infoBtn');

  const passwordForm = document.getElementById('passwordForm');
  const passwordMsg = document.getElementById('passwordMsg');
  const passwordBtn = document.getElementById('passwordBtn');

  const profileName = document.getElementById('profileName');
  const profileUsername = document.getElementById('profileUsername');
  const profileAvatar = document.getElementById('profileAvatar');

  // ============ Navbar toggle ============
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ============ Logout ============
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
      window.location.href = '/login';
    });
  }

  // ============ Helpers ============
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (_) { return iso; }
  }

  function setMsg(el, text, type) {
    el.textContent = text || '';
    el.className = 'msg' + (type ? ' ' + type : '');
  }

  // ============ Tabs ============
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const name = tab.dataset.tab;
      sections.forEach((s) => s.classList.toggle('active', s.dataset.section === name));

      // Load section data lazily
      if (name === 'orders') loadOrders();
      if (name === 'results') loadResults();
      if (name === 'visits') loadVisits();
    });
  });

  // ============ API helper ============
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      credentials: 'same-origin',
      ...options,
    });
    if (res.status === 401) { window.location.href = '/login'; throw new Error('unauthorized'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || 'فشل الطلب');
    return json;
  }

  // ============ Load user into form ============
  async function loadUser() {
    try {
      const { data } = await api('/api/me');
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
      profileName.textContent = fullName || 'مستخدم';
      profileUsername.textContent = '@' + (data.username || '—');
      profileAvatar.textContent = (data.firstName?.[0] || data.username?.[0] || '؟').toUpperCase();

      // Fill form
      if (infoForm) {
        infoForm.firstName.value = data.firstName || '';
        infoForm.lastName.value = data.lastName || '';
        infoForm.username.value = data.username || '';
        infoForm.phone.value = data.phone || '';
        infoForm.email.value = data.email || '';
        infoForm.gender.value = data.gender || '';
        infoForm.dob.value = data.dob || '';
        const addr = data.address || {};
        infoForm.city.value = addr.city || '';
        infoForm.area.value = addr.area || '';
        infoForm.street.value = addr.street || '';
        infoForm.building.value = addr.building || '';
        infoForm.apartment.value = addr.apartment || '';
        infoForm.floor.value = addr.floor || '';
      }
    } catch (_) { /* handled in api() */ }
  }

  // ============ Save info ============
  infoForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(infoMsg, '');
    infoBtn.disabled = true;
    infoBtn.textContent = 'جارٍ الحفظ...';
    try {
      const payload = {
        firstName: infoForm.firstName.value.trim(),
        lastName: infoForm.lastName.value.trim(),
        phone: infoForm.phone.value.trim(),
        email: infoForm.email.value.trim().toLowerCase(),
        gender: infoForm.gender.value,
        dob: infoForm.dob.value,
        address: {
          city: infoForm.city.value.trim(),
          area: infoForm.area.value.trim(),
          street: infoForm.street.value.trim(),
          building: infoForm.building.value.trim(),
          apartment: infoForm.apartment.value.trim(),
          floor: infoForm.floor.value.trim(),
        },
      };
      await api('/api/me', { method: 'PATCH', body: JSON.stringify(payload) });
      setMsg(infoMsg, 'تم حفظ التعديلات.', 'ok');
      // تحديث الاسم في الأعلى
      const name = [payload.firstName, payload.lastName].filter(Boolean).join(' ');
      if (name) profileName.textContent = name;
      if (payload.firstName) profileAvatar.textContent = payload.firstName[0].toUpperCase();
    } catch (err) {
      setMsg(infoMsg, err.message, 'error');
    } finally {
      infoBtn.disabled = false;
      infoBtn.textContent = 'حفظ التعديلات';
    }
  });

  // ============ Change password ============
  passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(passwordMsg, '');

    const cur = passwordForm.currentPassword.value;
    const nw = passwordForm.newPassword.value;
    const cf = passwordForm.confirmPassword.value;

    if (nw.length < 8) return setMsg(passwordMsg, 'كلمة السر الجديدة 8 أحرف على الأقل', 'error');
    if (nw !== cf) return setMsg(passwordMsg, 'كلمتا السر غير متطابقتين', 'error');

    passwordBtn.disabled = true;
    passwordBtn.textContent = 'جارٍ التغيير...';
    try {
      await api('/api/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
      });
      setMsg(passwordMsg, 'تم تغيير كلمة السر بنجاح.', 'ok');
      passwordForm.reset();
    } catch (err) {
      setMsg(passwordMsg, err.message, 'error');
    } finally {
      passwordBtn.disabled = false;
      passwordBtn.textContent = 'تغيير كلمة السر';
    }
  });

  // ============ Load orders ============
  async function loadOrders() {
    const list = document.getElementById('ordersList');
    const empty = document.getElementById('ordersEmpty');
    list.innerHTML = '<div class="skeleton-line"></div>';
    try {
      const { data } = await api('/api/orders?limit=5');
      const items = data.items || data || [];
      if (!items.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = items.map((o) => `
        <div class="list-item">
          <div class="li-main">
            <strong>طلب ${esc(o.orderId || o.id)}</strong>
            <span>${esc(formatDate(o.createdAt))} · ${esc((o.itemsCount || 0) + ' عنصر')}</span>
          </div>
          <span class="badge ${statusClass(o.status)}">${esc(o.status || '—')}</span>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = `<p style="color:var(--muted);font-size:13px;">${esc(err.message)}</p>`;
    }
  }

  // ============ Load results ============
  async function loadResults() {
    const list = document.getElementById('resultsList');
    const empty = document.getElementById('resultsEmpty');
    list.innerHTML = '<div class="skeleton-line"></div>';
    try {
      const { data } = await api('/api/results?limit=5');
      const items = data.items || data || [];
      if (!items.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = items.map((r) => `
        <div class="list-item">
          <div class="li-main">
            <strong>${esc(r.title || 'نتيجة')}</strong>
            <span>طلب ${esc(r.orderId || '—')} · ${esc(formatDate(r.createdAt))}</span>
          </div>
          <span class="badge ${statusClass(r.status)}">${esc(r.status || '—')}</span>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = `<p style="color:var(--muted);font-size:13px;">${esc(err.message)}</p>`;
    }
  }

  // ============ Load visits ============
  async function loadVisits() {
    const list = document.getElementById('visitsList');
    const empty = document.getElementById('visitsEmpty');
    list.innerHTML = '<div class="skeleton-line"></div>';
    try {
      const { data } = await api('/api/home-visits?limit=5');
      const items = data.items || data || [];
      if (!items.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      list.innerHTML = items.map((v) => `
        <div class="list-item">
          <div class="li-main">
            <strong>${esc(v.itemName || 'زيارة')}</strong>
            <span>${esc(formatDate(v.scheduledAt))} · ${esc(v.slot || '')}</span>
          </div>
          <span class="badge ${statusClass(v.status)}">${esc(v.status || '—')}</span>
        </div>`).join('');
    } catch (err) {
      list.innerHTML = `<p style="color:var(--muted);font-size:13px;">${esc(err.message)}</p>`;
    }
  }

  // ============ Status helper ============
  function statusClass(status) {
    if (!status) return 'muted';
    const s = String(status).toUpperCase();
    const map = {
      PENDING: 'warn', PROCESSING: 'info', READY: 'ok', VERIFIED: 'ok',
      PUBLISHED: 'ok', VIEWED: 'muted', COMPLETED: 'ok', CANCELLED: 'danger',
      NEW: 'info', CONFIRMED: 'info', ASSIGNED: 'info',
      ON_THE_WAY: 'warn', COLLECTED: 'warn',
    };
    return map[s] || 'muted';
  }

  // ============ Init ============
  document.addEventListener('DOMContentLoaded', loadUser);

})();