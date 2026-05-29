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

  // ====== Phone inputs: фиксированный префикс +375 ======
  const PREFIX = '+375 ';

  function formatPhone(input) {
    let pos = input.selectionStart;
    if (pos == null) pos = 0;
    let digits = input.value.replace(/\D/g, '');
    if (digits.startsWith('375')) digits = digits.slice(3);
    else if (digits.startsWith('80')) digits = digits.slice(1);
    digits = digits.slice(0, 9);

    let formatted = PREFIX;
    if (digits.length > 0) formatted += '(' + digits.slice(0, 2);
    if (digits.length >= 2) formatted += ') ' + digits.slice(2, 5);
    if (digits.length >= 5) formatted += '-' + digits.slice(5, 7);
    if (digits.length >= 7) formatted += '-' + digits.slice(7, 9);

    input.value = formatted;
    if (pos < PREFIX.length) pos = PREFIX.length;
    input.setSelectionRange(pos, pos);
  }

  document.querySelectorAll('input[type="tel"]').forEach(el => {
    if (!el.value || el.value === '+') el.value = PREFIX;

    el.addEventListener('focus', function () {
      if (this.value === PREFIX || this.value.length < 5) this.value = PREFIX;
      setTimeout(() => { this.selectionStart = this.selectionEnd = PREFIX.length; }, 0);
    });

    el.addEventListener('input', function () { formatPhone(this); });

    el.addEventListener('keydown', function (e) {
      if ((e.key === 'Backspace' && this.selectionStart <= PREFIX.length) ||
          (e.key === 'Delete' && this.selectionStart < PREFIX.length)) {
        e.preventDefault();
      }
      if (e.key === 'Home') {
        setTimeout(() => { this.selectionStart = this.selectionEnd = PREFIX.length; }, 0);
      }
    });
  });

  // ====== Name inputs: запрет цифр и спецсимволов ======
  document.querySelectorAll('input[type="text"]').forEach(el => {
    const isName = (el.id || '').toLowerCase().includes('name') ||
      (el.placeholder || '').toLowerCase().includes('обращаться') ||
      (el.placeholder || '').toLowerCase().includes('имя');
    if (!isName) return;
    el.addEventListener('input', function () {
      this.value = this.value.replace(/[^а-яА-ЯёЁa-zA-Z\s\-]/g, '');
    });
  });

  // ====== Email inputs: только латиница + цифры + спецсимволы ======
  document.querySelectorAll('input[type="email"]').forEach(el => {
    el.addEventListener('input', function () {
      this.value = this.value.replace(/[^a-zA-Z0-9@._\-+~]/g, '');
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
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData);
      if (typeof gtag !== 'undefined') gtag('event', 'form_submit', { form_name: 'contact' });
      if (typeof ym !== 'undefined' && window.ymId) ym(window.ymId, 'reachGoal', 'form_submit');

      // Отправка в API
      const API_URL = 'https://api-production-d59b.up.railway.app/api/submit-order';

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name || data.homeName || '',
            phone: data.phone || data.homePhone || '',
            email: data.email || '',
            comment: data.comment || data.homeComment || '',
            kitchenType: data.kitchenType || '',
            budget: data.budget || '',
            source: 'Сайт',
            _honeypot: data.honeypot || '',
            ...getUTM(),
          }),
        });

        const result = await res.json();

        if (result.success) {
          contactForm.innerHTML = `
            <div style="text-align:center;padding:20px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin:0 auto 16px;display:block"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;margin-bottom:8px">Спасибо за заявку!</h3>
              <p style="color:var(--color-text-secondary)">Заявка #${result.orderId}. Перезвоним в течение 30 минут</p>
            </div>`;
        } else {
          alert('Ошибка отправки. Попробуйте ещё раз.');
        }
      } catch (err) {
        console.error('Submit error:', err);
        alert('Ошибка соединения. Проверьте подключение к интернету.');
      }
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

  // ====== Аналитика просмотров ======
  const API_ANALYTICS = 'https://api-production-d59b.up.railway.app/api/analytics';

  function getSessionId() {
    let sid = sessionStorage.getItem('analytics_sid');
    if (!sid) {
      sid = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('analytics_sid', sid);
    }
    return sid;
  }

  function sendPageview() {
    const utm = getUTM();
    fetch(`${API_ANALYTICS}/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: location.pathname,
        referrer: document.referrer || '',
        utm_source: utm.utm_source || '',
        utm_medium: utm.utm_medium || '',
        sessionId: getSessionId(),
      }),
    }).catch(() => {});
  }

  let heartbeatTimer;

  function startHeartbeat() {
    const sid = getSessionId();
    const start = Date.now();
    heartbeatTimer = setInterval(() => {
      const duration = Math.round((Date.now() - start) / 1000);
      fetch(`${API_ANALYTICS}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, duration }),
      }).catch(() => {});
    }, 15000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  sendPageview();
  startHeartbeat();
  window.addEventListener('beforeunload', () => {
    stopHeartbeat();
    const duration = Math.round((Date.now() - parseInt(getSessionId().split('_')[1])) / 1000);
    navigator.sendBeacon(`${API_ANALYTICS}/heartbeat`, JSON.stringify({ sessionId: getSessionId(), duration }));
  });

  console.log('[Дом кухни] Site initialized');
});
