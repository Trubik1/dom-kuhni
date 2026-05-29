/* =========================================
   ДОМ КУХНИ — SHARED: header, burger, cookie, exit popup, analytics, forms
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {

  // Header scroll
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('header--scrolled', window.scrollY > 50);
  }, { passive: true });

  // Mobile burger
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', () => nav.classList.toggle('header__nav--open'));
    document.querySelectorAll('.header__nav-link').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('header__nav--open'));
    });
  }

  // Format phone helper
  function formatPhone(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.startsWith('375')) v = v.slice(3);
    else if (v.startsWith('80')) v = v.slice(1);
    const prevLen = v.length;
    let f = '+375';
    if (v.length > 0) f += ' (' + v.slice(0, 2);
    if (v.length >= 2) f += ') ' + v.slice(2, 5);
    if (v.length >= 5) f += '-' + v.slice(5, 7);
    if (v.length >= 7) f += '-' + v.slice(7, 9);
    if (input.value !== f) input.value = f;
  }

  // Phone inputs
  document.querySelectorAll('input[type="tel"]').forEach(el => {
    const separators = ['-', ' ', '(', ')'];
    el.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        const pos = el.selectionStart;
        if (pos > 0 && separators.includes(el.value[pos - 1])) {
          e.preventDefault();
          const newVal = el.value.slice(0, pos - 1) + el.value.slice(pos);
          el.value = newVal;
          el.selectionStart = el.selectionEnd = pos - 1;
          formatPhone(el);
        }
      }
    });
    el.addEventListener('input', e => {
      const pos = el.selectionStart;
      formatPhone(e.target);
      if (el.selectionStart !== undefined) el.selectionStart = el.selectionEnd = Math.min(pos, el.value.length);
    });
  });



  // UTM parser
  function getUTM() {
    const p = new URLSearchParams(location.search);
    const o = {};
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(k => { const v = p.get(k); if(v) o[k]=v; });
    return o;
  }

  // Track CTA clicks
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const label = this.textContent.trim().slice(0, 60);
      if (typeof gtag !== 'undefined') gtag('event', 'click', { event_category: 'CTA', event_label: label });
      if (typeof ym !== 'undefined' && window.ymId) ym(window.ymId, 'reachGoal', 'cta_click', { label });
    });
  });

  // Scroll depth (throttled, cached layout reads)
  let tracked = new Set();
  let depthBody, depthWin;
  const updateDepthCache = () => { depthBody = document.body.scrollHeight; depthWin = window.innerHeight; };
  updateDepthCache();
  const depthOnScroll = () => {
    const pct = Math.round((window.scrollY / (depthBody - depthWin)) * 100);
    [25,50,75,90,100].forEach(d => { if (pct >= d && !tracked.has(d)) { tracked.add(d); if (typeof gtag !== 'undefined') gtag('event', 'scroll_depth', { depth: d+'%' }); } });
  };
  window.addEventListener('scroll', depthOnScroll, { passive: true });
  window.addEventListener('resize', updateDepthCache, { passive: true });

  // Count-up animation
  const countEls = document.querySelectorAll('.count-up');
  let counted = false;
  function doCountUp() {
    if (counted) return;
    countEls.forEach(el => {
      const target = parseInt(el.dataset.target);
      if (!target) return;
      let cur = 0;
      const step = Math.ceil(target / 40);
      const t = setInterval(() => {
        cur += step;
        if (cur >= target) { el.textContent = target + '+'; clearInterval(t); }
        else el.textContent = cur;
      }, 30);
    });
    counted = true;
  }
  if (countEls.length > 0) {
    const countObs = new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) { doCountUp(); obs.disconnect(); }
    }, { rootMargin: '0px 0px -100px 0px' });
    countObs.observe(countEls[0]);
  }

  // Scroll reveal (all variants)
  document.querySelectorAll('.reveal, .reveal-scale, .reveal-left, .reveal-right, .card-premium').forEach(el => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          if (el.classList.contains('card-premium')) {
            el.style.opacity = '1'; el.style.transform = 'none';
          } else {
            e.target.classList.add('visible');
          }
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    obs.observe(el);
  });

  // Contact form (on index.html and contact.html)
  const contactForm = document.getElementById('contactForm') || document.getElementById('homeForm');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(contactForm));
      console.log('[Lead] Contact form:', { ...data, ...getUTM() });
      if (typeof gtag !== 'undefined') gtag('event', 'form_submit', { form_name: 'contact' });

      // === ВСТАВЬТЕ ВАШ WEBHOOK / Formspree ===
      // fetch('https://formspree.io/f/YOUR_FORM_ID', {
      //   method: 'POST', body: JSON.stringify({ ...data, ...getUTM() }),
      //   headers: { 'Content-Type': 'application/json' }
      // });

      contactForm.innerHTML = `
        <div style="text-align:center;padding:20px">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin:0 auto 16px;display:block"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;margin-bottom:8px">Спасибо за заявку!</h3>
          <p style="color:var(--color-text-secondary)">Перезвоним в течение 30 минут</p>
        </div>`;
    });
  }

  // Theme toggle
  function getTheme() { return localStorage.getItem('theme') || 'light'; }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.innerHTML = t === 'dark'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    });
  }
  setTheme(getTheme());
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));
  });

  // Dynamic copyright year
  document.querySelectorAll('.footer__bottom p').forEach(el => {
    el.textContent = el.textContent.replace(/\d{4}/, new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Minsk' })).getFullYear());
  });

  console.log('[Дом кухни] Site initialized');
});
