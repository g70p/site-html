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
  var closedUntil = 0;

  try {
    closedUntil = Number(window.localStorage.getItem(storageKey));
  } catch (error) {
    closedUntil = 0;
  }

  if (!Number.isNaN(closedUntil) && closedUntil > now) {
    overlay.remove();
    return;
  }

  if (!closeButton) {
    return;
  }

  closeButton.addEventListener('click', function () {
    var nextCloseUntil = Date.now() + (24 * 60 * 60 * 1000);

    try {
      window.localStorage.setItem(storageKey, String(nextCloseUntil));
    } catch (error) {
      // Sem persistência disponível (modo privado/storage bloqueado).
    }

    overlay.remove();
  });
})();
