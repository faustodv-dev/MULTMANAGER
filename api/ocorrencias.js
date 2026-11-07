import { CFG, igual } from './_lib/base.js';
import { flushOcorrenciasEnviadas } from './_lib/ocorrencias.js';

export const config = { maxDuration: 60 };

/**
 * Flush das ocorrências informativas das mensagens já enviadas pela fila.
 * Cutucado pelo gateway (x-webhook-secret) a cada ~60s; aceita também o CRON_SECRET.
 */
export default async function handler(req, res) {
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const hdr = String(req.headers['x-webhook-secret'] || '');
  const ok =
    (CFG.webhookSecret && (igual(hdr, CFG.webhookSecret) || igual(auth, CFG.webhookSecret))) ||
    (CFG.cronSecret && auth && igual(auth, CFG.cronSecret));
  if (!ok) return res.status(401).json({ erro: 'nao_autorizado' });

  try {
    const r = await flushOcorrenciasEnviadas({ limite: 150 });
    return res.status(200).json({ ok: true, ...r });
  } catch (e) {
    return res.status(500).json({ erro: 'interno', mensagem: e.message });
  }
}
