/* =========================================================
   Value Lab — Book Home Visit Script
   ========================================================= */

(function () {
  'use strict';

  const form = document.getElementById('visitForm');
  const typeSelect = document.getElementById('typeSelect');
  const itemSelect = document.getElementById('itemSelect');
  const dateInput = document.getElementById('dateInput');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const logoutBtn = document.getElementById('logoutBtn');
  const recentVisits = document.getElementById('recentVisits');

  let tests = [];
  let packages = [];

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

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

  function setLoading(l) {
    submitBtn.disabled = l;
    submitBtn.textContent = l ? 'جارٍ الحجز...' : 'تأكيد الحجز';
  }

  // ============ Populate items ============
  function fillItems() {
    const source = typeSelect.value === 'package' ? packages : tests;
    if (!source.length) {
      itemSelect.innerHTML = '<option value="">لا يوجد عناصر متاحة</option>';
      return;
    }
    itemSelect.innerHTML = '<option value="">اختر</option>' +
      source.map((it) =>
        `<option value="${esc(it.id)}">${esc(it.name)}${it.price != null ? ' — ' + Number(it.price).toLocaleString('ar-EG') + ' ج.م' : ''}</option>`
      ).join('');
  }

  typeSelect?.addEventListener('change', fillItems);

  // ============ Load tests & packages ============
  async function fetchJSON(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (res.status === 401) { window.location.href = '/login'; throw new Error('unauthorized'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || 'فشل التحميل');
    return Array.isArray(json.data) ? json.data : [];
  }

  async function loadItems() {
    try {
      const [t, p] = await Promise.all([
        fetchJSON('/api/tests'),
        fetchJSON('/api/packages'),
      ]);
      tests = t;
      packages = p;
      fillItems();
    } catch (err) {
      itemSelect.innerHTML = '<option value="">تعذّر التحميل</option>';
    }
  }

  // ============ Load recent visits ============
  async function loadRecentVisits() {
    try {
      const res = await fetch('/api/home-visits?limit=3', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (res.status === 401) return;
      const json = await res.json().catch(() => ({}));
      const list = (json.data || []);
      if (!list.length) {
        recentVisits.innerHTML = '<h3>آخر زياراتك</h3><p style="color:var(--muted);font-size:13px;">لا توجد زيارات سابقة.</p>';
        return;
      }
      recentVisits.innerHTML = '<h3>آخر زياراتك</h3>' + list.map((v) => `
        <div class="visit-item">
          <div><strong>${esc(v.itemName || 'زيارة')}</strong>
            <span class="status">${esc(v.status || 'NEW')}</span>
          </div>
          <div>${esc(new Date(v.scheduledAt).toLocaleDateString('ar-EG'))} · ${esc(v.slot || '')}</div>
        </div>`).join('');
    } catch (_) { /* silent */ }
  }

  // ============ Date min ============
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  // ============ Submit ============
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg('');

    const data = {
      type: typeSelect.value,
      itemId: itemSelect.value,
      date: dateInput.value,
      slot: document.getElementById('slotSelect').value,
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      notes: form.notes.value.trim(),
      agree: form.agree.checked,
    };

    if (!data.itemId) return setMsg('اختار التحليل أو الباقة', 'error');
    if (!data.date) return setMsg('اختار التاريخ', 'error');
    if (!data.slot) return setMsg('اختار الوقت', 'error');
    if (!/^[0-9+\-\s]{8,20}$/.test(data.phone)) return setMsg('رقم الهاتف غير صحيح', 'error');
    if (!data.address) return setMsg('العنوان مطلوب', 'error');
    if (!data.agree) return setMsg('يجب الموافقة على الشروط', 'error');

    setLoading(true);
    try {
      const res = await fetch('/api/home-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || 'فشل الحجز');

      setMsg('تم استلام طلبك، هنكلمك للتأكيد قريب.', 'ok');
      form.reset();
      fillItems();
      loadRecentVisits();
    } catch (err) {
      setMsg(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      setLoading(false);
    }
  });

  // ============ Init ============
  document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    loadRecentVisits();
  });

})();