/* =========================================================
   Value Lab — Tests & Packages Script
   ========================================================= */

(function () {
  'use strict';

  const itemsGrid = document.getElementById('itemsGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const sortFilter = document.getElementById('sortFilter');
  const tabs = document.querySelectorAll('.tab');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const logoutBtn = document.getElementById('logoutBtn');

  // State
  let activeTab = 'tests';       // 'tests' | 'packages'
  let allTests = [];
  let allPackages = [];

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

  function money(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    return `${v.toLocaleString('ar-EG')} <small>ج.م</small>`;
  }

  // ============ Tabs ============
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeTab = tab.dataset.tab;
      applyFilters();
    });
  });

  // ============ Categories ============
  function populateCategories() {
    const cats = new Set();
    allTests.forEach((t) => t.category && cats.add(t.category));
    allPackages.forEach((p) => p.category && cats.add(p.category));

    const current = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="">كل التصنيفات</option>' +
      Array.from(cats).sort().map((c) =>
        `<option value="${esc(c)}">${esc(c)}</option>`
      ).join('');
    categoryFilter.value = current;
  }

  // ============ Render ============
  function renderItem(item, isPackage) {
    const priceMain = item.price != null ? money(item.price) : '';
    const priceOld =
      isPackage && item.originalPrice != null && Number(item.originalPrice) > Number(item.price)
        ? `<span class="price-old">${Number(item.originalPrice).toLocaleString('ar-EG')} ج.م</span>`
        : '';

    const metaParts = [];
    if (item.category) metaParts.push(`<span>التصنيف: ${esc(item.category)}</span>`);
    if (item.sampleType) metaParts.push(`<span>نوع العينة: ${esc(item.sampleType)}</span>`);
    if (item.turnaround) metaParts.push(`<span>مدة النتيجة: ${esc(item.turnaround)}</span>`);
    if (isPackage && item.testsCount) metaParts.push(`<span>عدد التحاليل: ${esc(item.testsCount)}</span>`);

    const metaHtml = metaParts.length
      ? `<div class="item-meta">${metaParts.join('')}</div>`
      : '';

    return `
      <article class="item-card" data-id="${esc(item.id || '')}">
        <div class="item-head">
          <h3>${esc(item.name || (isPackage ? 'باقة' : 'تحليل'))}</h3>
          <span class="tag ${isPackage ? 'package' : ''}">${isPackage ? 'باقة' : 'تحليل'}</span>
        </div>

        ${item.description ? `<p class="item-desc">${esc(item.description)}</p>` : ''}

        ${metaHtml}

        <div class="item-price">
          <div>
            <div class="price-main">${priceMain}</div>
            ${priceOld ? `<div>${priceOld}</div>` : ''}
          </div>
        </div>

        <div class="item-actions">
          <button class="btn btn-primary btn-sm" data-action="book" data-id="${esc(item.id || '')}" data-type="${isPackage ? 'package' : 'test'}">احجز</button>
          <button class="btn btn-outline btn-sm" data-action="details" data-id="${esc(item.id || '')}" data-type="${isPackage ? 'package' : 'test'}">التفاصيل</button>
        </div>
      </article>`;
  }

  function renderItems(items, isPackage) {
    if (!items.length) {
      itemsGrid.innerHTML = '';
      itemsGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    itemsGrid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    itemsGrid.innerHTML = items.map((it) => renderItem(it, isPackage)).join('');
  }

  // ============ Filtering + Sorting ============
  function applyFilters() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const cat = categoryFilter.value;
    const sort = sortFilter.value;

    const source = activeTab === 'tests' ? allTests : allPackages;
    const isPackage = activeTab === 'packages';

    let filtered = source.filter((it) => {
      const name = (it.name || '').toLowerCase();
      const desc = (it.description || '').toLowerCase();
      const matchesQ = !q || name.includes(q) || desc.includes(q);
      const matchesCat = !cat || it.category === cat;
      return matchesQ && matchesCat;
    });

    if (sort === 'price-asc') {
      filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sort === 'price-desc') {
      filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sort === 'name-asc') {
      filtered.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
    }

    renderItems(filtered, isPackage);
  }

  // Wire filters
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
  if (sortFilter) sortFilter.addEventListener('change', applyFilters);

  // ============ Card actions ============
  itemsGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const type = btn.dataset.type;

    if (action === 'book') {
      window.location.href = `/book-visit?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
    } else if (action === 'details') {
      // Placeholder: يفتح تفاصيل لاحقًا
      alert(`تفاصيل ${type === 'package' ? 'الباقة' : 'التحليل'}: ${id}`);
    }
  });

  // ============ Load data ============
  async function fetchJSON(url) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (res.status === 401) {
      window.location.href = '/login';
      throw new Error('unauthorized');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'فشل تحميل البيانات');
    }
    return Array.isArray(json.data) ? json.data : [];
  }

  async function loadAll() {
    try {
      // في الـbackend، /api/tests و /api/packages هيرجعوا فقط العناصر المتاحة للمستخدم
      const [tests, packages] = await Promise.all([
        fetchJSON('/api/tests'),
        fetchJSON('/api/packages'),
      ]);

      allTests = tests;
      allPackages = packages;

      populateCategories();
      applyFilters();
    } catch (err) {
      itemsGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      emptyState.querySelector('h3').textContent = 'تعذّر تحميل البيانات';
      emptyState.querySelector('p').textContent = err.message || 'حاول مرة أخرى لاحقًا.';
    }
  }

  document.addEventListener('DOMContentLoaded', loadAll);

})();