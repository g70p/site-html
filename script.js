(() => {
  'use strict';

  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Header scrolled state
  const header = qs('.site-header');
  const onScrollHeader = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 50);
  };
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  // Mobile menu
  const burger = qs('.burger');
  const nav = qs('#nav');
  const setMenu = (open) => {
    if (!burger || !nav) return;
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  };
  burger?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  qsa('#nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  // Active section highlight
  const links = qsa('#nav a');
  const sections = links
    .map(a => qs(a.getAttribute('href')))
    .filter(Boolean);

  const activate = (id) => {
    links.forEach(a => a.classList.toggle('active', a.dataset.id === id));
  };

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      // Pick the most visible section
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) activate(visible.target.id);
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0.05, 0.15, 0.3, 0.6] });

    sections.forEach(s => obs.observe(s));
  } else {
    // Fallback: first link always active
    activate('home');
  }

  // Footer year
  const yearEl = qs('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Cookie banner
  const cookie = qs('#cookie');
  const cookieAccept = qs('#cookieAccept');
  const COOKIE_KEY = 'resigrip_cookie_accepted';
  const showCookie = () => { if (cookie) cookie.hidden = false; };
  const hideCookie = () => { if (cookie) cookie.hidden = true; };

  try {
    const accepted = localStorage.getItem(COOKIE_KEY) === '1';
    if (!accepted) showCookie();
  } catch { /* ignore */ }

  cookieAccept?.addEventListener('click', () => {
    try { localStorage.setItem(COOKIE_KEY, '1'); } catch { /* ignore */ }
    hideCookie();
  });

  // Contact form (static): validate endpoint configured
  const form = qs('#contactForm');
  const statusEl = qs('#formStatus');
  const btn = form?.querySelector('button[type="submit"]');

  const setError = (name, msg) => {
    const box = qs(`.error[data-for="${name}"]`);
    if (box) box.textContent = msg || '';
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const message = String(fd.get('message') || '').trim();

    let ok = true;
    setError('name',''); setError('email',''); setError('message','');
    if (!name) { setError('name', 'Indique o seu nome.'); ok = false; }
    if (!email) { setError('email', 'Indique o seu email.'); ok = false; }
    else if (!validateEmail(email)) { setError('email', 'Email inválido.'); ok = false; }
    if (!message) { setError('message', 'Escreva a sua mensagem.'); ok = false; }

    if (!ok) {
      statusEl && (statusEl.textContent = 'Corrija os campos assinalados.');
      return;
    }

    // Envio: preferir action (Formspree) e cair para endpoint local se existir
    const endpoint = form.getAttribute('action') || form.getAttribute('data-endpoint') || '/api/contact';
    if (btn) btn.disabled = true;
    statusEl && (statusEl.textContent = 'A enviar…');

    const isRemote = /^https?:\/\//i.test(endpoint);

    const req = isRemote
      ? fetch(endpoint, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: fd
        })
      : fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message, page: location.href })
        });

    req.then(async (r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // Formspree devolve JSON; endpoint local pode/deve devolver JSON
      let payload = null;
      try { payload = await r.json(); } catch { /* ignore */ }
      statusEl && (statusEl.textContent = payload?.ok ? 'Mensagem enviada com sucesso.' : 'Mensagem enviada.');
      form.reset();
    }).catch(() => {
      statusEl && (statusEl.textContent = 'Falha no envio. Tente novamente ou use o botão “Enviar email”.');
    }).finally(() => {
      if (btn) btn.disabled = false;
    });
  });

  // Botão de voltar ao topo
  const scrollTopBtn = qs('#scrollTop');
  const onScrollTopBtn = () => {
    if (!scrollTopBtn) return;
    scrollTopBtn.classList.toggle('visible', window.scrollY > 320);
  };

  scrollTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', onScrollTopBtn, { passive: true });
  onScrollTopBtn();

  // Carousel (produtos)
  qsa('.carousel').forEach((wrap) => {
    const track = qs('.carousel-track', wrap);
    const prev = qs('.carousel-btn.prev', wrap);
    const next = qs('.carousel-btn.next', wrap);
    if (!track || !prev || !next) return;

    const stepSize = () => {
      const card = qs('.card', track);
      const w = card ? (card.getBoundingClientRect().width + 18) : 320;
      return Math.max(280, Math.floor(w));
    };

    prev.addEventListener('click', () => track.scrollBy({ left: -stepSize(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left:  stepSize(), behavior: 'smooth' }));
  });

  // Particles (lightweight)
  const canvas = qs('#particles');
  const ctx = canvas?.getContext?.('2d');
  if (!canvas || !ctx) return;

  const state = {
    w: 0, h: 0, dpr: Math.min(2, window.devicePixelRatio || 1),
    particles: [],
    last: 0
  };

  function resize(){
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = state.w + 'px';
    canvas.style.height = state.h + 'px';
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }
  window.addEventListener('resize', resize, { passive:true });
  resize();

  const rand = (a,b) => a + Math.random()*(b-a);

  function seed(){
    const count = Math.round((state.w * state.h) / 38000); // scales with area
    state.particles = Array.from({length: Math.max(24, Math.min(90, count))}, () => ({
      x: rand(0, state.w),
      y: rand(0, state.h),
      r: rand(0.8, 2.2),
      vx: rand(-0.12, 0.12),
      vy: rand(-0.10, 0.10),
      a: rand(0.06, 0.16)
    }));
  }
  seed();

  function step(t){
    const dt = Math.min(40, t - (state.last || t));
    state.last = t;

    ctx.clearRect(0,0,state.w,state.h);

    // faint vignette
    const grad = ctx.createRadialGradient(state.w*0.6, state.h*0.15, 10, state.w*0.6, state.h*0.15, Math.max(state.w,state.h)*0.9);
    grad.addColorStop(0, 'rgba(255,176,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,state.w,state.h);

    for (const p of state.particles){
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < -10) p.x = state.w + 10;
      if (p.x > state.w + 10) p.x = -10;
      if (p.y < -10) p.y = state.h + 10;
      if (p.y > state.h + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,176,0,${p.a})`;
      ctx.fill();
    }

    // links (sparse)
    ctx.lineWidth = 1;
    for (let i=0;i<state.particles.length;i++){
      const a = state.particles[i];
      for (let j=i+1;j<state.particles.length;j++){
        const b = state.particles[j];
        const dx = a.x-b.x, dy = a.y-b.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < 140*140){
          const alpha = (1 - d2/(140*140)) * 0.08;
          ctx.strokeStyle = `rgba(255,176,0,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

(function () {
  var overlay = document.getElementById('site-evolucao-overlay');
  if (!overlay) {
    return;
  }

  var storageKey = 'evolucaoOverlayClosedUntil';
  var closeButton = overlay.querySelector('#evolucao-overlay-close');
  var now = Date.now();
  var closedUntil = Number(window.localStorage.getItem(storageKey));

  if (!Number.isNaN(closedUntil) && closedUntil > now) {
    overlay.remove();
    return;
  }

  if (!closeButton) {
    return;
  }

  closeButton.addEventListener('click', function () {
    var nextCloseUntil = Date.now() + (24 * 60 * 60 * 1000);
    window.localStorage.setItem(storageKey, String(nextCloseUntil));
    overlay.remove();
  });
})();

(() => {
  'use strict';

  const PRODUCTS = [
    {
      id: 'COLACO_RG_PACK3_BLEND',
      title: 'DRY_BLEND 80/20',
      shortTitle: '2BLENDS Water Glass 4',
      description: 'Tack para mãos ativas: estabilidade na pressão, consistência no toque. TACK_COLAÇO RG_PACK3u - DRY_BLEND WWG_80/20 Nível_7. +-5,4g',
      buyDescription: 'Estabilidade na pressão e consistência no toque. Nível 7. +- 5,4g',
      sku: 'COLAÇO RG PACK3 BLEND',
      image: '/assets/images/keep calm and im learning to use a camera.webp'
    },
    {
      id: 'COLACO_RG_PACK5_DRY',
      title: 'DRY 80/20',
      shortTitle: 'DRY 3',
      description: 'Controlo total. Aderência seca e limpa. TACK_COLAÇO RG_PACK5u - DRY WW_80/20 Nível_5. +-9g',
      buyDescription: 'Aderência seca e limpa. Nível 3. +- 9g',
      sku: 'COLAÇO RG PACK5 DRY',
      image: '/assets/images/keep calm and im learning to use a camera.webp'
    },
    {
      id: 'COLACO_RG_PACK3_PURE_POWER',
      title: 'DRY_PURE-POWER',
      shortTitle: 'PURE-POWER 4',
      description: 'Tack moderno para ritmo rápido: segurança sem resíduos. TACK_COLAÇO RG_PACK3u - PURE-POWER XWW_PURE Nível_9,5 +-5,4g',
      buyDescription: 'Ritmo rápido e segurança sem resíduos. Nível 9. +- 5,4g',
      sku: 'COLAÇO RG PACK3 PURE-POWER',
      image: '/assets/images/keep calm and im learning to use a camera.webp'
    }
  ];

  window.RESIGRIP_PRODUCTS = PRODUCTS;

  const CART_KEY = 'resigrip_cart';
  const CHECKOUT_NOTE_KEY = 'resigrip_checkout_note';

  const qs = (sel, root = document) => root.querySelector(sel);

  const readCart = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeCart = (rows) => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(rows));
  };

  const enqueueProduct = (id, qty) => {
    const amount = Number(qty);
    if (!id || !Number.isFinite(amount) || amount <= 0) return;
    const cart = readCart();
    cart.push({ id, qty: amount });
    writeCart(cart);
  };

  const appendMessage = (text) => {
    const message = qs('#message');
    if (!message || !text.trim()) return false;
    const base = (message.value || '').trim();
    const separator = base ? '\n\n---\n\n' : '';
    message.value = `${base}${separator}${text}`.trim() + '\n';
    return true;
  };

  const buildProductsLines = (rows) => {
    const list = rows
      .map((row) => {
        const product = PRODUCTS.find((item) => item.id === row.id);
        if (!product) return '';
        return `- Produto: ${product.title} | Quantidade: ${row.qty}`;
      })
      .filter(Boolean);

    if (!list.length) return '';

    return [
      'Pedido de encomenda RESIGRIP',
      ...list,
      'Anexe comprovativo de pagamento fazendo o upload do ficheiro.',
      'Método de pagamento: [PREENCHER]'
    ].join('\n');
  };

  const processCartIntoMessage = () => {
    const rows = readCart();
    if (!rows.length) return false;
    const message = qs('#message');
    if (!message) return false;
    const block = buildProductsLines(rows);
    const wrote = appendMessage(block);
    if (wrote) {
      writeCart([]);
      return true;
    }
    return false;
  };

  const renderTodaAGama = () => {
    const track = qs('#todaGamaTrack');
    if (!track) return;
    track.innerHTML = PRODUCTS.map((product) => `
      <article class="card range-card" data-product-id="${product.id}">
        <div class="card-media" role="img" aria-label="${product.title}" style="background-image:url('${product.image}');"></div>
        <div class="card-body">
          <span class="badge">Novidade</span>
          <h3 class="h3">${product.title}</h3>
          <p>${product.description}</p>
          <div class="buy-controls">
            <label class="muted" for="qty-${product.id}">Quantidade a encomendar</label>
            <input id="qty-${product.id}" class="qty" type="number" min="1" value="1" inputmode="numeric" />
          </div>
          <div class="range-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="select-product" data-product="${product.id}">Selecionar este produto</button>
            <a class="btn btn-ghost btn-sm" href="comprar.html?produto=${product.id}">Detalhes</a>
          </div>
        </div>
      </article>
    `).join('');
  };

  const renderFeatured = () => {
    const track = qs('#featuredTrack');
    if (!track) return;
    track.innerHTML = PRODUCTS.map((product) => `
      <article class="card featured-card" data-product-id="${product.id}">
        <div class="card-media" role="img" aria-label="${product.title}" style="background-image:url('${product.image}');"></div>
        <div class="card-body">
          <span class="badge">Novidade</span>
          <h3 class="h3">${product.title}</h3>
          <div class="range-actions">
            <a class="btn btn-ghost btn-sm" href="comprar.html?produto=${product.id}">Detalhes</a>
            <button class="btn btn-primary btn-sm" type="button" data-action="feature-order" data-product="${product.id}">Encomendar</button>
          </div>
        </div>
        <p class="card-desc-out">${product.description}</p>
      </article>
    `).join('');
  };

  const fillQuickProductSelect = () => {
    const select = qs('#quickProductSelect');
    if (!select) return;
    select.innerHTML = PRODUCTS.map((product) => `<option value="${product.id}">${product.title}</option>`).join('');
  };

  const goToContact = () => {
    window.location.href = 'index.html#contacto';
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const selectButton = target.closest('[data-action="select-product"]');
    if (selectButton) {
      const id = selectButton.getAttribute('data-product') || '';
      const card = selectButton.closest('[data-product-id]');
      const qtyEl = card ? qs('.qty', card) : null;
      const qty = Number(qtyEl?.value || 1);
      enqueueProduct(id, qty);
      goToContact();
      return;
    }

    const featureOrder = target.closest('[data-action="feature-order"]');
    if (featureOrder) {
      const id = featureOrder.getAttribute('data-product') || '';
      enqueueProduct(id, 1);
      const section = qs('#contacto');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState({}, '', '#contacto');
        processCartIntoMessage();
      }
    }
  });

  const initOrderPanel = () => {
    const toggle = qs('#orderDataToggle');
    const panel = qs('#orderDataPanel');
    const insertDataBtn = qs('#insertOrderData');
    const quickAddBtn = qs('#quickAddProduct');

    if (toggle && panel) {
      toggle.addEventListener('click', () => {
        const opening = panel.hidden;
        panel.hidden = !opening;
        toggle.setAttribute('aria-expanded', String(opening));
      });
    }

    insertDataBtn?.addEventListener('click', () => {
      const name = (qs('#name')?.value || '').trim() || '[PREENCHER]';
      const address = (qs('#orderAddress')?.value || '').trim() || '[PREENCHER]';
      const postal = (qs('#orderPostal')?.value || '').trim() || '[PREENCHER]';
      const notes = (qs('#orderNotes')?.value || '').trim() || '(sem notas)';
      const payment = (qs('#orderPayment')?.value || '').trim() || '[PREENCHER]';

      const lines = [
        'Dados para encomenda',
        `- Nome: ${name}`,
        `- Morada: ${address}`,
        `- Código postal / Localidade: ${postal}`,
        `- Notas: ${notes}`,
        `- Método de pagamento: ${payment}`,
        'Anexe comprovativo de pagamento fazendo o upload do ficheiro.'
      ].join('\n');

      window.localStorage.setItem(CHECKOUT_NOTE_KEY, lines);
      appendMessage(lines);
    });

    quickAddBtn?.addEventListener('click', () => {
      const productId = qs('#quickProductSelect')?.value || '';
      const qty = Number(qs('#quickProductQty')?.value || 1);
      enqueueProduct(productId, qty);
      processCartIntoMessage();
    });
  };

  renderTodaAGama();
  renderFeatured();
  fillQuickProductSelect();
  initOrderPanel();

  const canProcessCartIntoMessage = Boolean(qs('#contactForm') && qs('#message'));
  const shouldProcess = canProcessCartIntoMessage && (window.location.hash === '#contacto' || readCart().length > 0);
  if (shouldProcess) processCartIntoMessage();

  window.addEventListener('hashchange', () => {
    if (canProcessCartIntoMessage && window.location.hash === '#contacto') {
      processCartIntoMessage();
    }
  });
})();

(() => {
  'use strict';

  const applyOverflowGuard = () => {
    if (!document.documentElement || !document.body) return;
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
  };

  applyOverflowGuard();
  window.addEventListener('resize', applyOverflowGuard, { passive: true });
  window.addEventListener('orientationchange', applyOverflowGuard, { passive: true });
})();

(function(){
  const STORAGE_KEY = 'resigrip_theme';
  let hasUserPreference = false;

  function safeGet(key){
    try { return window.localStorage.getItem(key); } catch(e){ return null; }
  }
  function safeSet(key, val){
    try { window.localStorage.setItem(key, val); } catch(e){ /* ignore */ }
  }

  function systemPrefersDark(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    const buttons = document.querySelectorAll('.theme-toggle');
    buttons.forEach((btn) => {
      btn.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    });
  }

  function initTheme(){
    const saved = safeGet(STORAGE_KEY);
    hasUserPreference = saved === 'light' || saved === 'dark';
    const theme = hasUserPreference ? saved : (systemPrefersDark() ? 'dark' : 'light');
    applyTheme(theme);
  }

  function toggleTheme(){
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    safeSet(STORAGE_KEY, next);
    hasUserPreference = true;
  }

  document.addEventListener('DOMContentLoaded', function(){
    initTheme();
    const buttons = document.querySelectorAll('.theme-toggle');
    buttons.forEach((btn) => {
      btn.addEventListener('click', toggleTheme);
    });

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = function(event){
        if (!hasUserPreference) {
          applyTheme(event.matches ? 'dark' : 'light');
        }
      };
      if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
      else if (typeof media.addListener === 'function') media.addListener(onChange);
    }
  });
})();

(function () {
  var STORAGE_KEY = 'resigrip_theme';

  function safeGetTheme() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function safeSetTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* no-op */
    }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var buttons = document.querySelectorAll('.theme-toggle');
    buttons.forEach(function (button) {
      button.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
    });
  }

  function initTheme() {
    var storedTheme = safeGetTheme();
    var initialTheme = storedTheme || 'dark';
    applyTheme(initialTheme);
  }

  function onToggleTheme() {
    var current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    safeSetTheme(next);
  }

  function bindThemeToggle() {
    var buttons = document.querySelectorAll('.theme-toggle');
    buttons.forEach(function (button) {
      button.addEventListener('click', onToggleTheme);
    });
  }

  function bindSystemSchemeGuard() {
    if (!window.matchMedia) {
      return;
    }

    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var enforceDefaultDark = function () {
      var savedTheme = safeGetTheme();
      if (!savedTheme) {
        applyTheme('dark');
      }
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', enforceDefaultDark);
      return;
    }

    if (typeof media.addListener === 'function') {
      media.addListener(enforceDefaultDark);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initTheme();
      bindThemeToggle();
      bindSystemSchemeGuard();
    });
  } else {
    initTheme();
    bindThemeToggle();
    bindSystemSchemeGuard();
  }
})();

(function () {
  var STORAGE_KEY = 'resigrip_theme';

  function safeGetTheme() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      return stored === 'dark' || stored === 'light' ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function safeSetTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* no-op */
    }
  }

  function applyTheme(theme) {
    var finalTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = finalTheme;

    var toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(function (toggle) {
      toggle.setAttribute('aria-checked', finalTheme === 'dark' ? 'true' : 'false');
    });
  }

  function getNextTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  }

  function onToggleClick() {
    var next = getNextTheme();
    applyTheme(next);
    safeSetTheme(next);
  }

  function resetToggleListeners() {
    var toggles = document.querySelectorAll('.theme-toggle');
    toggles.forEach(function (toggle) {
      var cleanToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(cleanToggle, toggle);
      cleanToggle.addEventListener('click', onToggleClick);
    });
  }

  function initThemeToggleFix() {
    var storedTheme = safeGetTheme();
    applyTheme(storedTheme || 'dark');
    resetToggleListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggleFix);
  } else {
    initThemeToggleFix();
  }
})();
