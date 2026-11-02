import { CFG, registrar } from './base.js';
import { simulando } from './contexto.js';

/** Envia texto (e opcionalmente um documento) pelo gateway WhatsApp da unidade. */
export async function enviarWhatsapp(unitId, telefone, texto, { remoteJid = null, documento = null, conversaId = null } = {}) {
  if (simulando()) return { ok: true, status: 'simulado', erro: null, msgId: null };
  const inicio = Date.now();
  try {
    const resp = await fetch(`${CFG.gatewayUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.gatewayKey },
      body: JSON.stringify({ unitId, phone: telefone, remoteJid, message: texto || '', document: documento, waitForDelivery: true }),
      signal: AbortSignal.timeout(50000)
    });
    const json = await resp.json().catch(() => ({}));
    const ok = resp.ok && (json.status === 'sent' || json.status === 'queued_humanized');
    await registrar('gateway', documento ? 'enviar_documento' : 'enviar_texto', ok, {
      unitId, conversaId, duracaoMs: Date.now() - inicio, detalhe: ok ? { status: json.status } : { http: resp.status, erro: json.error }
    });
    return { ok, status: json.status || 'erro', erro: json.error || null, msgId: json.msgId || null };
  } catch (e) {
    await registrar('gateway', 'enviar', false, { unitId, conversaId, duracaoMs: Date.now() - inicio, detalhe: { erro: e.message } });
    return { ok: false, status: 'erro', erro: e.message };
  }
}
