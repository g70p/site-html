(() => {
  'use strict';

  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const qs = (sel, root=document) => root.querySelector(sel);

  const items = qsa('.buy-item');
  const btn = qs('#gerar');
  const out = qs('#resultado');
  const pre = qs('#texto');
  const copyBtn = qs('#copiar');
  const emailLink = qs('#emailLink');

  const fields = {
    nome: qs('#nome'),
    email: qs('#email'),
    morada: qs('#morada'),
    cidade: qs('#cidade'),
    notas: qs('#notas')
  };

  function getCart(){
    return items.map((it) => {
      const qty = Number(qs('.qty', it)?.value || 0);
      return {
        sku: it.dataset.sku,
        name: it.dataset.name,
        price: it.dataset.price,
        qty
      };
    }).filter(i => i.qty > 0);
  }

  function buildMessage(cart){
    const nome = (fields.nome.value || '').trim();
    const email = (fields.email.value || '').trim();
    const morada = (fields.morada.value || '').trim();
    const cidade = (fields.cidade.value || '').trim();
    const notas = (fields.notas.value || '').trim();

    const lines = [];
    lines.push('PEDIDO RESIGRIP — CONFIRMAÇÃO DE ENVIO');
    lines.push('');
    lines.push('1) Dados do cliente');
    lines.push(`- Nome: ${nome || '[PREENCHER]'}`);
    lines.push(`- Email: ${email || '[PREENCHER]'}`);
    lines.push(`- Morada: ${morada || '[PREENCHER]'}`);
    lines.push(`- Código postal / Localidade: ${cidade || '[PREENCHER]'}`);
    lines.push('');
    lines.push('2) Produtos');
    if (!cart.length){
      lines.push('- [SEM PRODUTOS SELECIONADOS]');
    } else {
      cart.forEach((i) => {
        lines.push(`- ${i.qty}x ${i.name} (SKU: ${i.sku}) — ${i.price}`);
      });
    }
    lines.push('');
    lines.push('3) Pagamento');
    lines.push('- Método: [PayPal / Transferência / MB Way]');
    lines.push('- Referência/ID do pagamento: [PREENCHER]');
    lines.push('');
    lines.push('4) Notas');
    lines.push(notas ? `- ${notas}` : '- (sem notas)');
    lines.push('');
    lines.push('Obrigado.');

    return lines.join('\n');
  }

  function setMailto(message){
    const to = 'resigrip.portugal@gmail.com';
    const subject = encodeURIComponent('Pedido ResiGrip — Confirmação de envio');
    const body = encodeURIComponent(message);
    emailLink.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  btn?.addEventListener('click', () => {
    const cart = getCart();
    const msg = buildMessage(cart);
    pre.textContent = msg;
    setMailto(msg);
    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent || '');
      copyBtn.textContent = 'Copiado';
      setTimeout(() => (copyBtn.textContent = 'Copiar'), 900);
    } catch {
      // fallback: selecionar texto
      const r = document.createRange();
      r.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      document.execCommand('copy');
      sel.removeAllRanges();
    }
  });
})();