/* =========================================================
   Value Lab — Notifications Script
   ========================================================= */

(function () {
  'use strict';

  const notifList = document.getElementById('notifList');
  const emptyState = document.getElementById('emptyState');
  const unreadCount = document.getElementById('unreadCount');
  const readCount = document.getElementById('readCount');
  const typeFilter = document.getElementById('typeFilter');
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const logoutBtn = document.getElementById('logoutBtn');

  // State
  let allItems = [];
  let page = 1;
  const PAGE_SIZE = 20;

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
      const d = new Date(iso);
      const now = Date.now();
      const diff = now - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return 'الآن';
      if (mins < 60) return `منذ ${mins} دقيقة`;
      if (hours < 24) return `منذ ${hours} ساعة`;
      if (days < 7) return `منذ ${days} يوم`;

      return d.toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (_) { return iso; }
  }

  // ============ Icon mapping ============
  function iconFor(type) {
    const t = (type || 'GENERAL').toUpperCase();
    if (t === 'RESULT_READY') {
      return {
        cls: 'result',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      };
    }
    if (t === 'ORDER_CREATED') {
      return {
        cls: 'order',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4"/><path d="M9 7V3h6v4"/></svg>`,
      };
    }
    if (t === 'HOME_VISIT_CONFIRMED' || t === 'HOME_VISIT_ASSIGNED') {
      return {
        cls: 'visit',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9z"/></svg>`,
      };
    }
    if (t === 'PASSWORD_RESET') {
      return {
        cls: 'security',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      };
    }
    return {
      cls: 'general',
      svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    };
  }

  // ============ Render ============
  function renderItems() {
    const type = typeFilter.value;
    const filtered = allItems.filter((n) => !type || (n.type || '').toUpperCase() === type);

    if (!filtered.length) {
      notifList.innerHTML = '';
      emptyState.classList.remove('hidden');
      loadMoreWrap.classList.add('hidden');
      updateSummary();
      return;
    }

    emptyState.classList.add('hidden');
    notifList.innerHTML = filtered.map((n) => {
      const ic = iconFor(n.type);
      const unread = n.read === false;
      const action = n.link
        ? `<a class="icon-btn" href="${esc(n.link)}" title="فتح" aria-label="فتح">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
           </a>`
        : '';
      const markBtn = unread
        ? `<button class="icon-btn" data-action="mark-read" data-id="${esc(n.id)}" title="تعليم كمقروء" aria-label="تعليم كمقروء">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
           </button>`
        : '';

      return `
        <article class="notif-card ${unread ? 'unread' : ''}" data-id="${esc(n.id)}">
          <div class="notif-icon ${ic.cls}" aria-hidden="true">${ic.svg}</div>
          <div class="notif-body">
            <h4>${esc(n.title || 'إشعار')}</h4>
            ${n.message ? `<p>${esc(n.message)}</p>` : ''}
            <div class="meta">
              <span>${esc(formatDate(n.createdAt))}</span>
            </div>
          </div>
          <div class="notif-actions">
            ${markBtn}
            ${action}
          </div>
        </article>`;
    }).join('');

    updateSummary();
    loadMoreWrap.classList.toggle('hidden', allItems.length >= (page * PAGE_SIZE) === false);
  }

  function updateSummary() {
    const unread = allItems.filter((n) => n.read === false).length;
    const read = allItems.length - unread;
    unreadCount.textContent = unread.toLocaleString('ar-EG');
    readCount.textContent = read.toLocaleString('ar-EG');
  }

  // ============ API ============
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

  // ============ Load ============
  async function loadNotifications(reset = true) {
    if (reset) { page = 1; allItems = []; }

    try {
      const { data } = await api(`/api/notifications?page=${page}&limit=${PAGE_SIZE}`);
      const items = Array.isArray(data) ? data : (data.items || []);
      const total = data.total ?? items.length;

      if (reset) allItems = items;
      else allItems = allItems.concat(items);

      renderItems();

      // Show load more?
      if (allItems.length < total) {
        loadMoreWrap.classList.remove('hidden');
      } else {
        loadMoreWrap.classList.add('hidden');
      }
    } catch (err) {
      if (err.message !== 'unauthorized') {
        notifList.innerHTML = '';
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h3').textContent = 'تعذّر تحميل الإشعارات';
        emptyState.querySelector('p').textContent = err.message;
      }
    }
  }

  // ============ Filters ============
  typeFilter?.addEventListener('change', renderItems);

  // ============ Load more ============
  loadMoreBtn?.addEventListener('click', () => {
    page += 1;
    loadNotifications(false);
  });

  // ============ Mark as read (single) ============
  notifList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="mark-read"]');
    if (!btn) return;
    const id = btn.dataset.id;
    try {
      await api(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
      const item = allItems.find((n) => n.id === id);
      if (item) item.read = true;
      renderItems();
    } catch (err) {
      console.warn(err);
    }
  });

  // ============ Mark all as read ============
  markAllReadBtn?.addEventListener('click', async () => {
    markAllReadBtn.disabled = true;
    markAllReadBtn.textContent = 'جارٍ...';
    try {
      await api('/api/notifications/read-all', { method: 'PATCH' });
      allItems = allItems.map((n) => ({ ...n, read: true }));
      renderItems();
    } catch (err) {
      console.warn(err);
    } finally {
      markAllReadBtn.disabled = false;
      markAllReadBtn.textContent = 'تعليم الكل كمقروء';
    }
  });

  // ============ Init ============
  document.addEventListener('DOMContentLoaded', () => loadNotifications(true));

})();