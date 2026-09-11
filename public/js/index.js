/* =========================================================
   Value Lab — Homepage Script
   ========================================================= */

(function () {
  'use strict';

  // ============ Navbar toggle (mobile) ============
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });

    navLinks.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ============ Hero search ============
  const heroSearch = document.getElementById('heroSearch');
  if (heroSearch) {
    heroSearch.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('searchInput').value.trim();
      const url = q
        ? `/testspackages?q=${encodeURIComponent(q)}`
        : '/testspackages';
      window.location.href = url;
    });
  }

  // ============ Safe fetch helper ============
  async function fetchJSON(url) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json && Array.isArray(json.data) ? json.data : [];
    } catch (err) {
      console.warn('[Value Lab] fetch failed:', url, err.message);
      return [];
    }
  }

  // ============ Escape HTML (XSS protection) ============
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
    const num = Number(n);
    if (!Number.isFinite(num)) return '';
    return `${num.toLocaleString('ar-EG')} <small>ج.م</small>`;
  }

  // ============ Render helpers ============
  function emptyCard(message) {
    return `<div class="empty-card">${esc(message)}</div>`;
  }

  function testCard(t) {
    return `
      <article class="test-card">
        <h3>${esc(t.name || 'تحليل')}</h3>
        <p>${esc(t.description || '')}</p>
        ${t.price != null ? `<div class="price">${money(t.price)}</div>` : ''}
        <a class="btn btn-outline" href="/testspackages?test=${encodeURIComponent(t.id || '')}">التفاصيل</a>
      </article>`;
  }

  function packageCard(p) {
    const price = p.price != null ? money(p.price) : '';
    const original =
      p.originalPrice != null && Number(p.originalPrice) > Number(p.price)
        ? `<span style="text-decoration:line-through;color:#7c8798;margin-inline-start:8px;">${Number(p.originalPrice).toLocaleString('ar-EG')}</span>`
        : '';
    return `
      <article class="package-card">
        <h3>${esc(p.name || 'باقة')}</h3>
        <p>${esc(p.description || '')}</p>
        ${price ? `<div class="price">${price}${original}</div>` : ''}
        <a class="btn btn-primary" href="/testspackages?package=${encodeURIComponent(p.id || '')}">اشترك الآن</a>
      </article>`;
  }

  function branchCard(b) {
    return `
      <article class="branch-card">
        <h3>${esc(b.name || 'فرع')}</h3>
        <p>${esc(b.address || '')}</p>
        ${b.phone ? `<p>${esc(b.phone)}</p>` : ''}
        ${b.hours ? `<p>${esc(b.hours)}</p>` : ''}
      </article>`;
  }

  // ============ Load sections ============
  async function loadFeaturedTests() {
    const el = document.getElementById('featuredTests');
    if (!el) return;
    const items = await fetchJSON('/api/tests?featured=true&limit=3');
    el.innerHTML = items.length
      ? items.slice(0, 3).map(testCard).join('')
      : emptyCard('لا توجد تحاليل مميزة حاليًا');
  }

  async function loadFeaturedPackages() {
    const el = document.getElementById('featuredPackages');
    if (!el) return;
    const items = await fetchJSON('/api/packages?featured=true&limit=3');
    el.innerHTML = items.length
      ? items.slice(0, 3).map(packageCard).join('')
      : emptyCard('لا توجد باقات حاليًا');
  }

  async function loadBranches() {
    const el = document.getElementById('branchesList');
    if (!el) return;
    const items = await fetchJSON('/api/branches');
    el.innerHTML = items.length
      ? items.slice(0, 3).map(branchCard).join('')
      : emptyCard('سيتم إضافة الفروع قريبًا');
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadFeaturedTests();
    loadFeaturedPackages();
    loadBranches();
  });
})();