/* =========================================================
   Value Lab — Results Script
   ========================================================= */

(function () {
  'use strict';

  const listEl = document.getElementById('resultsList');
  const emptyEl = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const logoutBtn = document.getElementById('logoutBtn');

  let allResults = [];

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
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (_) { /* ignore */ }
      window.location.href = '/login';
    });
  }

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

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (_) { return iso; }
  }

  const STATUS_LABEL = {
    READY: 'جاهزة',
    PENDING: 'في الانتظار',
    PROCESSING: 'قيد التحليل',
    VIEWED: 'تم الاطلاع',
  };

  // ============ Render ============
  function renderResults(items) {
    if (!items.length) {
      listEl.innerHTML = '';
      listEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    listEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');

    listEl.innerHTML = items.map((r) => {
      const status = (r.status || 'PENDING').toUpperCase();
      const statusLabel = STATUS_LABEL[status] || status;

      const itemsHtml = (r.items || []).map((it) => {
        const isAbnormal = it.abnormal === true;
        return `
          <div class="row">
            <div>${esc(it.name || '')}</div>
            <div class="value ${isAbnormal ? 'flag-abnormal' : ''}">${esc(it.value ?? '-')}</div>
            <div>${esc(it.unit ?? '')}</div>
            <div class="range">${esc(it.referenceRange ?? '-')}</div>
          </div>`;
      }).join('');

      const table = (r.items && r.items.length) ? `
        <div class="result-table">
          <div class="row header">
            <div>التحليل</div>
            <div>النتيجة</div>
            <div>الوحدة</div>
            <div>النطاق الطبيعي</div>
          </div>
          ${itemsHtml}
        </div>` : '';

      const actions = [];
      if (r.pdfUrl && status !== 'PENDING' && status !== 'PROCESSING') {
        actions.push(`<a class="btn btn-primary btn-sm" href="${esc(r.pdfUrl)}" target="_blank" rel="noopener">تحميل PDF</a>`);
      }
      if (r.id) {
        actions.push(`<button class="btn btn-outline btn-sm" type="button" data-print="${esc(r.id)}">طباعة</button>`);
      }

      return `
        <article class="result-card" data-id="${esc(r.id || '')}">
          <div class="result-head">
            <div>
              <h3>${esc(r.title || 'تحليل')}</h3>
              <div class="meta">
                رقم الطلب: ${esc(r.orderId || '-')} ·
                التاريخ: ${esc(formatDate(r.createdAt))}
              </div>
            </div>
            <span class="badge ${status.toLowerCase()}">${esc(statusLabel)}</span>
          </div>
          ${table}
          ${actions.length ? `<div class="result-actions">${actions.join('')}</div>` : ''}
        </article>`;
    }).join('');
  }

  // ============ Filtering ============
  function applyFilters() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const st = statusFilter.value;

    const filtered = allResults.filter((r) => {
      const matchQ = !q || (r.title || '').toLowerCase().includes(q);
      const matchS = !st || (r.status || '').toUpperCase() === st;
      return matchQ && matchS;
    });

    renderResults(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyFilters);

  // ============ Print handler ============
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-print]');
    if (!btn) return;
    const card = btn.closest('.result-card');
    if (card) window.print();
  });

  // ============ Load results ============
  async function loadResults() {
    try {
      const res = await fetch('/api/results', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'فشل تحميل النتائج');
      }

      allResults = Array.isArray(json.data) ? json.data : [];
      applyFilters();
    } catch (err) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      emptyEl.querySelector('h3').textContent = 'تعذّر تحميل النتائج';
      emptyEl.querySelector('p').textContent = err.message || 'حاول مرة أخرى لاحقًا.';
    }
  }

  document.addEventListener('DOMContentLoaded', loadResults);

})();