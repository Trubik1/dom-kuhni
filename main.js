/* =========================================
   ДОМ КУХНИ — SHARED: header, video, burger, theme, analytics, forms
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {

  // Video Autoplay & Low Power Mode fallback
  const heroVideo = document.querySelector('.hero__video');
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    const playPromise = heroVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay prevented by browser power saving mode: play on first touch/click
        const startVideoOnTouch = () => {
          heroVideo.play().catch(() => {});
          window.removeEventListener('touchstart', startVideoOnTouch);
          window.removeEventListener('click', startVideoOnTouch);
        };
        window.addEventListener('touchstart', startVideoOnTouch, { passive: true });
        window.addEventListener('click', startVideoOnTouch, { passive: true });
      });
    }
  }

  // Header scroll shadow & theme transition
  const header = document.getElementById('header');
  if (header) {
    const updateHeaderScroll = () => {
      header.classList.toggle('header--scrolled', window.scrollY > 30);
    };
    updateHeaderScroll();
    window.addEventListener('scroll', updateHeaderScroll, { passive: true });
  }

  // Mobile burger & Body scroll lock
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (burger && nav) {
    const toggleMenu = (open) => {
      const isOpen = open !== undefined ? open : !nav.classList.contains('header__nav--open');
      nav.classList.toggle('header__nav--open', isOpen);
      burger.classList.toggle('active', isOpen);
      if (header) header.classList.toggle('header--menu-open', isOpen);
      document.body.classList.toggle('menu-open', isOpen);
    };

    burger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    document.querySelectorAll('.header__nav-link, .mobile-social-btn, .mobile-menu-contacts a').forEach(link => {
      link.addEventListener('click', () => {
        toggleMenu(false);
      });
    });

    // Close when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('header__nav--open') && !nav.contains(e.target) && !burger.contains(e.target)) {
        toggleMenu(false);
      }
    });
  }

  // FAQ Accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    });
  });

  // ====== Phone inputs: фиксированный префикс +375 ======
  const PREFIX = '+375 ';

  function formatPhone(input) {
    let pos = input.selectionStart || 0;
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

  // ====== Name inputs ======
  document.querySelectorAll('input[type="text"]').forEach(el => {
    const isName = (el.id || '').toLowerCase().includes('name') ||
      (el.placeholder || '').toLowerCase().includes('обращаться') ||
      (el.placeholder || '').toLowerCase().includes('имя');
    if (!isName) return;
    el.addEventListener('input', function () {
      this.value = this.value.replace(/[^а-яА-ЯёЁa-zA-Z\s\-]/g, '');
    });
  });

  // ====== Email inputs ======
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

  // Contact form handler
  const contactForm = document.getElementById('contactForm') || document.getElementById('homeForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData);
      if (typeof gtag !== 'undefined') gtag('event', 'form_submit', { form_name: 'contact' });
      if (typeof ym !== 'undefined' && window.ymId) ym(window.ymId, 'reachGoal', 'form_submit');

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
            <div style="text-align:center;padding:24px">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B8934C" stroke-width="2" style="margin:0 auto 16px;display:block"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <h3 style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;margin-bottom:8px">Спасибо за заявку!</h3>
              <p style="color:var(--color-text-secondary)">Заявка принята. Дизайнер свяжется с вами в течение 30 минут.</p>
            </div>`;
        } else {
          alert('Ошибка отправки. Пожалуйста, позвоните нам напрямую: +375 (44) 584-22-33');
        }
      } catch (err) {
        console.error('Submit error:', err);
        alert('Ошибка соединения. Проверьте подключение к интернету или позвоните: +375 (44) 584-22-33');
      }
    });
  }

  // Animated Pill Theme toggle
  function renderThemeToggle(btn) {
    btn.innerHTML = `
      <span class="theme-toggle__track-icons">
        <svg class="theme-toggle__icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg class="theme-toggle__icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </span>
      <span class="theme-toggle__thumb">
        <svg class="theme-toggle__thumb-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        <svg class="theme-toggle__thumb-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      </span>
    `;
  }

  function getTheme() { return localStorage.getItem('theme') || 'light'; }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.setAttribute('aria-checked', t === 'dark' ? 'true' : 'false');
      btn.setAttribute('title', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    });
  }

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    renderThemeToggle(btn);
    btn.setAttribute('role', 'switch');
    btn.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));
  });
  setTheme(getTheme());

  // Dynamic copyright year
  document.querySelectorAll('.footer__bottom p').forEach(el => {
    el.textContent = el.textContent.replace(/\d{4}/, new Date().getFullYear());
  });

  // ====== PORTFOLIO SLIDERS & LIGHTBOX (SHARED) ======
  // Card sliders
  document.querySelectorAll('.card-slider').forEach(slider => {
    const track = slider.querySelector('.card-slider__track');
    const slides = track ? track.querySelectorAll('.card-slider__slide') : [];
    if (!slides.length) return;
    const dots = slider.querySelectorAll('.card-slider__dot');
    const prev = slider.querySelector('.card-slider__btn--prev');
    const next = slider.querySelector('.card-slider__btn--next');
    let idx = 0;
    const go = i => {
      idx = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (idx * 100) + '%)';
      dots.forEach((d, j) => d.classList.toggle('active', j === idx));
    };
    if (prev) prev.addEventListener('click', e => { e.stopPropagation(); go(idx - 1); });
    if (next) next.addEventListener('click', e => { e.stopPropagation(); go(idx + 1); });
    dots.forEach((d, i) => {
      d.dataset.i = i;
      d.addEventListener('click', e => { e.stopPropagation(); go(i); });
    });

    // Touch swipe
    let touchData = {};
    slider.addEventListener('touchstart', e => {
      const t = e.changedTouches[0];
      touchData = { startX: t.screenX, startY: t.screenY, moved: false };
    }, { passive: true });
    slider.addEventListener('touchmove', e => {
      if (!touchData.startX) return;
      const t = e.changedTouches[0];
      const dx = Math.abs(t.screenX - touchData.startX);
      const dy = Math.abs(t.screenY - touchData.startY);
      if (dx > 10 && dx > dy) {
        touchData.moved = true;
        e.preventDefault();
      }
    }, { passive: false });
    slider.addEventListener('touchend', e => {
      if (!touchData.startX) return;
      const dx = e.changedTouches[0].screenX - touchData.startX;
      if (touchData.moved && Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
      touchData = {};
    }, { passive: true });
  });

  // Lightbox
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const lbImg = document.getElementById('lightboxImg');
    const lbTitle = document.getElementById('lightboxTitle');
    const lbDesc = document.getElementById('lightboxDesc');
    const lbClose = document.getElementById('lightboxClose');
    const lbPrev = document.getElementById('lightboxPrev');
    const lbNext = document.getElementById('lightboxNext');
    const lbCalc = document.getElementById('lightboxCalcBtn');

    let curPhotos = [];
    let curIndex = 0;

    function openLightboxFromBtn(btn, initialIdx = 0) {
      try {
        curPhotos = JSON.parse(btn.dataset.photos || '[]');
      } catch (e) {
        curPhotos = [];
      }
      if (!curPhotos.length) return;
      curIndex = initialIdx;
      if (lbTitle) lbTitle.textContent = btn.dataset.title || '';
      if (lbDesc) lbDesc.textContent = btn.dataset.desc || '';
      const card = btn.closest('.portfolio-card');
      const pid = card ? card.dataset.id : '';
      if (lbCalc) lbCalc.href = `calculator.html?project=${pid}`;
      showLbPhoto(curIndex);
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function showLbPhoto(idx) {
      if (!curPhotos.length) return;
      curIndex = (idx + curPhotos.length) % curPhotos.length;
      if (lbImg) lbImg.src = curPhotos[curIndex];
      if (lbPrev && lbNext) {
        lbPrev.style.display = curPhotos.length > 1 ? 'flex' : 'none';
        lbNext.style.display = curPhotos.length > 1 ? 'flex' : 'none';
      }
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('.portfolio-card__zoom-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openLightboxFromBtn(btn, 0);
      });
    });

    document.querySelectorAll('.card-slider__slide').forEach((slide, sIdx) => {
      slide.addEventListener('click', e => {
        e.stopPropagation();
        const card = slide.closest('.portfolio-card');
        const zoomBtn = card ? card.querySelector('.portfolio-card__zoom-btn') : null;
        if (zoomBtn) openLightboxFromBtn(zoomBtn, sIdx);
      });
    });

    if (lbClose) lbClose.addEventListener('click', closeLightbox);
    if (lbPrev) lbPrev.addEventListener('click', () => showLbPhoto(curIndex - 1));
    if (lbNext) lbNext.addEventListener('click', () => showLbPhoto(curIndex + 1));
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showLbPhoto(curIndex - 1);
      if (e.key === 'ArrowRight') showLbPhoto(curIndex + 1);
    });
  }

  // Home page Show More button
  const homeShowMoreBtn = document.getElementById('homeShowMoreBtn');
  const homePortfolioGrid = document.getElementById('homePortfolioGrid');
  if (homeShowMoreBtn && homePortfolioGrid) {
    homeShowMoreBtn.addEventListener('click', () => {
      const isCollapsed = homePortfolioGrid.classList.contains('portfolio-grid--collapsed');
      if (isCollapsed) {
        homePortfolioGrid.classList.remove('portfolio-grid--collapsed');
        homeShowMoreBtn.textContent = 'Свернуть обратно ↑';
      } else {
        homePortfolioGrid.classList.add('portfolio-grid--collapsed');
        homeShowMoreBtn.textContent = 'Показать ещё 6 проектов ↓';
      }
    });
  }

  // Home page Filter tabs
  const homeFilterBtns = document.querySelectorAll('[data-home-filter]');
  if (homeFilterBtns.length && homePortfolioGrid) {
    const homeCards = homePortfolioGrid.querySelectorAll('.portfolio-card');
    homeFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        homeFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.homeFilter;
        // Expand grid when filtering so matching cards are visible
        if (val !== 'all') {
          homePortfolioGrid.classList.remove('portfolio-grid--collapsed');
          if (homeShowMoreBtn) homeShowMoreBtn.style.display = 'none';
        } else {
          if (homeShowMoreBtn) {
            homeShowMoreBtn.style.display = '';
            homeShowMoreBtn.textContent = 'Показать ещё 6 проектов ↓';
          }
          homePortfolioGrid.classList.add('portfolio-grid--collapsed');
        }

        homeCards.forEach(card => {
          if (val === 'all') {
            card.style.display = '';
          } else if (card.dataset.category === val || card.dataset.layout === val) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  console.log('[Дом кухни] Initialized successfully');
});
