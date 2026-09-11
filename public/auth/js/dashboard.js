/* =========================================================
   Value Lab — Admin Dashboard Script
   ========================================================= */

(function () {
  'use strict';

  // ─── DOM refs ───────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const menuToggle = document.getElementById('menuToggle');
  const logoutBtn = document.getElementById('logoutBtn');
  const sideLinks = document.querySelectorAll('.side-link');
  const sections = document.querySelectorAll('.section');
  const pageTitle = document.getElementById('pageTitle');
  const refreshBtn = document.getElementById('refreshBtn');
  const userName = document.getElementById('userName');
  const userRole = document.getElementById('userRole');
  const userAvatar = document.getElementById('userAvatar');

  // Modal
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalBox = document.getElementById('modalBox');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalFoot = document.getElementById('modalFoot');
  const modalClose = document.getElementById('modalClose');

  // Toast
  const toastContainer = document.getElementById('toastContainer');

  // ============ Helpers ============
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function num(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('ar-EG');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (_) { return iso; }
  }

  function toast(text, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ============ Modal ============
  function openModal({ title, bodyHtml, confirmText = 'حفظ', onConfirm, danger = false }) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;
    modalFoot.innerHTML = `
      <button class="btn btn-outline" id="modalCancel" type="button">إلغاء</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modalConfirm" type="button">${esc(confirmText)}</button>
    `;
    modalBackdrop.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    document.getElementById('modalCancel').onclick = closeModal;
    document.getElementById('modalConfirm').onclick = async () => {
      const btn = document.getElementById('modalConfirm');
      btn.disabled = true;
      btn.textContent = 'جارٍ...';
      try {
        await onConfirm();
      } catch (err) {
        toast(err.message || 'حدث خطأ', 'error');
        btn.disabled = false;
        btn.textContent = confirmText;
      }
    };
  }

  function closeModal() {
    modalBackdrop.classList.add('hidden');
    modalBody.innerHTML = '';
    modalFoot.innerHTML = '';
    document.body.style.overflow = '';
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop.classList.contains('hidden')) {
      closeModal();
    }
  });

  // ============ Sidebar ============
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }

  // ============ Section routing ============
  const SECTION_TITLES = {
    dashboard: 'نظرة عامة',
    patients: 'إدارة المرضى',
    orders: 'إدارة الطلبات',
    results: 'إدارة النتائج',
    tests: 'إدارة التحاليل',
    packages: 'إدارة الباقات',
    homeVisits: 'الزيارات المنزلية',
    branches: 'الفروع',
    points: 'النقاط',
    staff: 'الموظفين',
    reports: 'التقارير',
    audit: 'سجل التدقيق',
    settings: 'الإعدادات',
  };

  function navigateTo(sectionName) {
    sideLinks.forEach((l) => l.classList.toggle('active', l.dataset.section === sectionName));
    sections.forEach((s) => s.classList.toggle('active', s.dataset.section === sectionName));
    pageTitle.textContent = SECTION_TITLES[sectionName] || 'لوحة التحكم';
    if (window.location.hash !== `#${sectionName}`) {
      window.location.hash = sectionName;
    }
    // Close mobile sidebar
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    // Lazy load section data
    loadSectionData(sectionName);
  }

  sideLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.section);
    });
  });

  window.addEventListener('hashchange', () => {
    const name = (window.location.hash || '#dashboard').substring(1);
    navigateTo(name);
  });

  // ============ API helper ============
  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      credentials: 'same-origin',
      ...options,
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = '/loginpanel';
      throw new Error('unauthorized');
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'فشل الطلب');
    }
    return json;
  }

  // ============ Logout ============
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      } catch (_) { /* ignore */ }
      window.location.href = '/loginpanel';
    });
  }

  // ============ Refresh ============
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const active = document.querySelector('.section.active')?.dataset.section;
      if (active) loadSectionData(active, true);
    });
  }

  // ============ Load user ============
  async function loadUser() {
    try {
      const { data } = await api('/api/me');
      const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || data.username || 'Admin';
      userName.textContent = name;
      userRole.textContent = data.role || 'ADMIN';
      userAvatar.textContent = (name[0] || 'A').toUpperCase();
    } catch (_) { /* handled in api() */ }
  }

  // ============ Section loaders ============
  async function loadSectionData(name, force = false) {
    try {
      switch (name) {
        case 'dashboard':      return loadDashboard(force);
        case 'patients':       return loadPatients();
        case 'orders':         return loadOrders();
        case 'results':        return loadResults();
        case 'tests':          return loadTests();
        case 'packages':       return loadPackages();
        case 'homeVisits':     return loadVisits();
        case 'branches':       return loadBranches();
        case 'points':         return loadPoints();
        case 'staff':          return loadStaff();
        case 'reports':        return loadReports();
        case 'audit':          return loadAudit();
        case 'settings':       return loadSettings();
      }
    } catch (err) {
      toast(err.message || 'فشل تحميل البيانات', 'error');
    }
  }

  // ============ 1. Dashboard ============
  async function loadDashboard() {
    const statsGrid = document.getElementById('statsGrid');
    const ordersByStatus = document.getElementById('ordersByStatus');
    try {
      const { data } = await api('/api/admin/dashboard');
      const s = data.stats || {};
      const cards = [
        { label: 'إجمالي المرضى', value: num(s.totalPatients || 0) },
        { label: 'إجمالي الطلبات', value: num(s.totalOrders || 0) },
        { label: 'نتائج في الانتظار', value: num(s.pendingResults || 0) },
        { label: 'نتائج مكتملة', value: num(s.completedResults || 0) },
        { label: 'زيارات منزلية', value: num(s.homeVisits || 0) },
        { label: 'الإيرادات', value: `${num(s.revenue || 0)} ج.م` },
        { label: 'مستخدمين جدد', value: num(s.newUsers || 0) },
        { label: 'تحاليل نشطة', value: num(s.activeTests || 0) },
      ];
      statsGrid.innerHTML = cards.map((c) => `
        <div class="stat-card">
          <span class="stat-label">${esc(c.label)}</span>
          <span class="stat-value">${esc(c.value)}</span>
        </div>`).join('');

      const rows = data.ordersByStatus || [];
      ordersByStatus.innerHTML = rows.length
        ? rows.map((r) => `
          <div class="stat-row">
            <span>${esc(r.status)}</span>
            <strong>${esc(num(r.count))}</strong>
          </div>`).join('')
        : '<p class="muted">لا توجد بيانات بعد.</p>';
    } catch (err) {
      statsGrid.innerHTML = `<div class="stat-card"><span class="stat-label">خطأ</span><span class="stat-value">—</span></div>`;
      ordersByStatus.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }

  // ============ 2. Patients ============
  async function loadPatients() {
    const tbody = document.getElementById('patientsTable');
    try {
      const { data } = await api('/api/admin/patients');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">لا يوجد مرضى بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((p) => `
        <tr>
          <td>${esc([p.firstName, p.lastName].filter(Boolean).join(' ') || '—')}</td>
          <td>${esc(p.username || '—')}</td>
          <td>${esc(p.phone || '—')}</td>
          <td>${esc(p.email || '—')}</td>
          <td>${p.active === false ? '<span class="badge danger">معطّل</span>' : '<span class="badge ok">نشط</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="view-patient" data-id="${esc(p.id)}">عرض</button>
              <button class="btn btn-outline btn-sm" data-action="toggle-patient" data-id="${esc(p.id)}" data-active="${p.active !== false}">${p.active !== false ? 'تعطيل' : 'تنشيط'}</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 3. Orders ============
  async function loadOrders() {
    const tbody = document.getElementById('ordersTable');
    try {
      const { data } = await api('/api/admin/orders');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">لا توجد طلبات بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((o) => `
        <tr>
          <td>${esc(o.orderId || o.id)}</td>
          <td>${esc(o.patientName || '—')}</td>
          <td>${esc(num(o.finalPrice || o.total || 0))} ج.م</td>
          <td>${statusBadge(o.status)}</td>
          <td>${esc(formatDate(o.createdAt))}</td>
          <td><button class="btn btn-outline btn-sm" data-action="view-order" data-id="${esc(o.id)}">عرض</button></td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 4. Results ============
  async function loadResults() {
    const tbody = document.getElementById('resultsTable');
    try {
      const { data } = await api('/api/admin/results');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد نتائج بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((r) => `
        <tr>
          <td>${esc(r.orderId || '—')}</td>
          <td>${esc(r.patientName || '—')}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${esc(formatDate(r.verifiedAt || r.publishedAt))}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="review-result" data-id="${esc(r.id)}">مراجعة</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 5. Tests ============
  async function loadTests() {
    const tbody = document.getElementById('testsTable');
    try {
      const { data } = await api('/api/admin/tests');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد تحاليل بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((t) => `
        <tr>
          <td>${esc(t.name)}</td>
          <td>${esc(t.category || '—')}</td>
          <td>${esc(num(t.price))} ج.م</td>
          <td>${t.active === false ? '<span class="badge muted">موقوف</span>' : '<span class="badge ok">نشط</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="edit-test" data-id="${esc(t.id)}">تعديل</button>
              <button class="btn btn-danger btn-sm" data-action="delete-test" data-id="${esc(t.id)}">حذف</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 6. Packages ============
  async function loadPackages() {
    const tbody = document.getElementById('packagesTable');
    try {
      const { data } = await api('/api/admin/packages');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد باقات بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((p) => `
        <tr>
          <td>${esc(p.name)}</td>
          <td>${esc(num(p.price))} ج.م</td>
          <td>${p.originalPrice ? esc(num(p.originalPrice)) + ' ج.م' : '—'}</td>
          <td>${p.active === false ? '<span class="badge muted">موقوفة</span>' : '<span class="badge ok">نشطة</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="edit-package" data-id="${esc(p.id)}">تعديل</button>
              <button class="btn btn-danger btn-sm" data-action="delete-package" data-id="${esc(p.id)}">حذف</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 7. Visits ============
  async function loadVisits() {
    const tbody = document.getElementById('visitsTable');
    try {
      const { data } = await api('/api/admin/home-visits');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">لا توجد زيارات بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((v) => `
        <tr>
          <td>${esc(v.visitId || v.id)}</td>
          <td>${esc(v.patientName || '—')}</td>
          <td>${esc(formatDate(v.scheduledAt))}</td>
          <td>${statusBadge(v.status)}</td>
          <td>${esc(v.assignedTo || '—')}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="edit-visit" data-id="${esc(v.id)}">تعديل</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 8. Branches ============
  async function loadBranches() {
    const tbody = document.getElementById('branchesTable');
    try {
      const { data } = await api('/api/admin/branches');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد فروع بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((b) => `
        <tr>
          <td>${esc(b.name)}</td>
          <td>${esc(b.address || '—')}</td>
          <td>${esc(b.phone || '—')}</td>
          <td>${b.active === false ? '<span class="badge muted">مغلق</span>' : '<span class="badge ok">مفتوح</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="edit-branch" data-id="${esc(b.id)}">تعديل</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 9. Points ============
  async function loadPoints() {
    const tbody = document.getElementById('pointsTable');
    try {
      const { data } = await api('/api/admin/points');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا توجد بيانات نقاط بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((p) => `
        <tr>
          <td>${esc(p.patientName || '—')}</td>
          <td>${esc(num(p.balance || 0))}</td>
          <td>${esc(num(p.totalEarned || 0))}</td>
          <td>${esc(num(p.totalRedeemed || 0))}</td>
          <td>
            <button class="btn btn-outline btn-sm" data-action="adjust-points" data-id="${esc(p.id)}">تعديل</button>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 10. Staff ============
  async function loadStaff() {
    const tbody = document.getElementById('staffTable');
    try {
      const { data } = await api('/api/admin/staff');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا يوجد موظفين بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((s) => `
        <tr>
          <td>${esc([s.firstName, s.lastName].filter(Boolean).join(' ') || s.username)}</td>
          <td>${esc(s.username || '—')}</td>
          <td>${esc(s.role || '—')}</td>
          <td>${s.active === false ? '<span class="badge danger">معطّل</span>' : '<span class="badge ok">نشط</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-outline btn-sm" data-action="edit-staff" data-id="${esc(s.id)}">تعديل</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 11. Reports ============
  async function loadReports() {
    // Empty by default — يتولد عند الضغط على الزر
  }

  document.getElementById('generateReportBtn')?.addEventListener('click', async () => {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    const out = document.getElementById('reportOutput');
    out.innerHTML = '<div class="skeleton-line"></div>';
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const { data } = await api(`/api/admin/reports?${qs.toString()}`);
      out.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><span class="stat-label">الإيرادات</span><span class="stat-value">${esc(num(data.revenue || 0))} ج.م</span></div>
          <div class="stat-card"><span class="stat-label">عدد الطلبات</span><span class="stat-value">${esc(num(data.orders || 0))}</span></div>
          <div class="stat-card"><span class="stat-label">عدد المرضى</span><span class="stat-value">${esc(num(data.patients || 0))}</span></div>
          <div class="stat-card"><span class="stat-label">زيارات منزلية</span><span class="stat-value">${esc(num(data.homeVisits || 0))}</span></div>
        </div>`;
    } catch (err) {
      out.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  });

  // ============ 12. Audit ============
  async function loadAudit() {
    const tbody = document.getElementById('auditTable');
    try {
      const { data } = await api('/api/admin/audit-logs');
      const list = data.items || data || [];
      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">لا يوجد سجل بعد.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map((l) => `
        <tr>
          <td>${esc(formatDate(l.createdAt))}</td>
          <td>${esc(l.userName || l.userId || '—')}</td>
          <td>${esc(l.action)}</td>
          <td>${esc(l.resource || '—')}</td>
          <td>${esc(l.ip || '—')}</td>
        </tr>`).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">${esc(err.message)}</td></tr>`;
    }
  }

  // ============ 13. Settings ============
  async function loadSettings() {
    try {
      const { data } = await api('/api/admin/settings');
      const f = document.getElementById('settingsForm');
      if (!f || !data) return;
      if (data.pointsPer10 != null) f.pointsPer10.value = data.pointsPer10;
      if (data.minRedeem != null) f.minRedeem.value = data.minRedeem;
      if (data.contactEmail) f.contactEmail.value = data.contactEmail;
      if (data.contactPhone) f.contactPhone.value = data.contactPhone;
    } catch (_) { /* ignore */ }
  }

  document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const msg = document.getElementById('settingsMsg');
    msg.textContent = '';
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          pointsPer10: Number(f.pointsPer10.value),
          minRedeem: Number(f.minRedeem.value),
          contactEmail: f.contactEmail.value,
          contactPhone: f.contactPhone.value,
        }),
      });
      msg.textContent = 'تم الحفظ.';
      msg.className = 'msg ok';
      toast('تم حفظ الإعدادات', 'ok');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'msg error';
    }
  });

  // ============ Badge helper ============
  function statusBadge(status) {
    if (!status) return '<span class="badge muted">—</span>';
    const s = String(status).toUpperCase();
    const map = {
      PENDING: 'warn',
      PROCESSING: 'info',
      READY: 'ok',
      VERIFIED: 'ok',
      PUBLISHED: 'ok',
      VIEWED: 'muted',
      COMPLETED: 'ok',
      CANCELLED: 'danger',
      NEW: 'info',
      CONFIRMED: 'info',
      ASSIGNED: 'info',
      ON_THE_WAY: 'warn',
      COLLECTED: 'warn',
      DRAFT: 'muted',
      READY_FOR_REVIEW: 'info',
    };
    return `<span class="badge ${map[s] || 'muted'}">${esc(s)}</span>`;
  }

  // ============ Wire "Add" buttons ============
  document.getElementById('addPatientBtn')?.addEventListener('click', () => {
    openModal({
      title: 'إضافة مريض جديد',
      bodyHtml: `
        <label><span>الاسم الأول</span><input name="firstName" required /></label>
        <label><span>اسم العائلة</span><input name="lastName" required /></label>
        <label><span>اسم المستخدم</span><input name="username" required /></label>
        <label><span>كلمة السر</span><input name="password" type="password" required minlength="8" /></label>
        <label><span>رقم الهاتف</span><input name="phone" /></label>
        <label><span>البريد الإلكتروني</span><input name="email" type="email" /></label>
      `,
      confirmText: 'إضافة',
      onConfirm: async () => {
        const b = modalBody;
        const payload = {
          firstName: b.querySelector('[name="firstName"]').value.trim(),
          lastName: b.querySelector('[name="lastName"]').value.trim(),
          username: b.querySelector('[name="username"]').value.trim().toLowerCase(),
          password: b.querySelector('[name="password"]').value,
          phone: b.querySelector('[name="phone"]').value.trim(),
          email: b.querySelector('[name="email"]').value.trim().toLowerCase(),
        };
        await api('/api/admin/patients', { method: 'POST', body: JSON.stringify(payload) });
        toast('تمت إضافة المريض', 'ok');
        closeModal();
        loadPatients();
      },
    });
  });

  // (ممكن تكمل باقي الأزرار بنفس النمط — addTestBtn, addPackageBtn, addBranchBtn ... إلخ)

  // ============ Row actions (event delegation) ============
  document.querySelector('.content').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    // TODO: wire each action to its own modal/handler
    console.log('action:', action, 'id:', id);
  });

  // ============ Init ============
  async function init() {
    await loadUser();
    const initial = (window.location.hash || '#dashboard').substring(1);
    navigateTo(initial);
  }

  document.addEventListener('DOMContentLoaded', init);

})();
