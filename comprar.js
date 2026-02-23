(() => {
  'use strict';

  const PRODUCTS = Array.isArray(window.RESIGRIP_PRODUCTS) ? window.RESIGRIP_PRODUCTS : [];
  const CART_KEY = 'resigrip_cart';

  const qs = (sel, root = document) => root.querySelector(sel);

  const readCart = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const enqueueProduct = (id, qty) => {
    const amount = Number(qty);
    if (!id || !Number.isFinite(amount) || amount <= 0) return;
    const rows = readCart();
    rows.push({ id, qty: amount });
    window.localStorage.setItem(CART_KEY, JSON.stringify(rows));
  };

  const renderBuyGrid = () => {
    const grid = qs('#buyGrid');
    if (!grid || !PRODUCTS.length) return;

    grid.innerHTML = PRODUCTS.map((product) => `
      <article class="card buy-item" id="prod-${product.id}" data-product-id="${product.id}">
        <div class="card-media buy-media" style="background-image:url('${product.image}');" role="img" aria-label="${product.title}"></div>
        <div class="card-body buy-card-body">
          <h3 class="h3">${product.shortTitle || product.title}</h3>
          <div class="buy-controls">
            <label class="muted" for="q-${product.id}">Quantidade a encomendar</label>
            <input id="q-${product.id}" class="qty" type="number" min="1" value="1" inputmode="numeric" />
          </div>
        </div>
        <p class="card-desc-out">${product.buyDescription || product.description}</p>
        <div class="range-actions buy-actions-inline">
          <button class="btn btn-primary btn-sm" type="button" data-action="generate-order" data-product="${product.id}">Gerar Mensagem para Encomenda</button>
          <a class="btn btn-ghost btn-sm" href="index.html#contacto">Ir para contacto</a>
        </div>
      </article>
    `).join('');
  };

  const getProductIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('produto');
    if (fromQuery) {
      if (fromQuery === 'DESTAQUE') {
        return PRODUCTS[0]?.id || '';
      }
      return fromQuery;
    }

    const hash = window.location.hash || '';
    if (hash.startsWith('#prod-')) {
      return hash.replace('#prod-', '');
    }
    return '';
  };

  const highlightProduct = (id) => {
    if (!id) return;
    const card = qs(`#prod-${id}`);
    if (!card) return;
    card.classList.add('product-highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => card.classList.remove('product-highlight'), 2000);
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest('[data-action="generate-order"]');
    if (!button) return;

    const id = button.getAttribute('data-product') || '';
    const card = button.closest('[data-product-id]');
    const qty = Number(qs('.qty', card || document)?.value || 1);
    enqueueProduct(id, qty);
    window.location.href = 'index.html#contacto';
  });

  renderBuyGrid();
  highlightProduct(getProductIdFromUrl());
})();
