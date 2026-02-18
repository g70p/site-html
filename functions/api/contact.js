export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const name = String(data?.name || '').trim();
    const email = String(data?.email || '').trim();
    const message = String(data?.message || '').trim();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ ok: false, error: 'Campos em falta.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    // TODO: Integrar envio real (ex.: MailChannels, SendGrid, Resend, webhook, etc.)
    // Por agora, devolve OK para o frontend confirmar receção.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'Erro no servidor.' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
}
