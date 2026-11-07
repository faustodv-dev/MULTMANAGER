import { CFG, igual, faltandoConfig } from './_lib/base.js';
import { processarEntrada } from './_lib/entrada.js';
import { flushOcorrenciasEnviadas } from './_lib/ocorrencias.js';

export const config = { maxDuration: 60 };

/** Recebe as mensagens do gateway (Render/Baileys) e responde pelo agente financeiro. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });

  const faltando = faltandoConfig(['supabaseUrl', 'supabaseServiceKey', 'webhookSecret', 'gatewayUrl', 'gatewayKey']);
  if (faltando.length) return res.status(500).json({ erro: 'config_ausente', faltando });

  const segredo = req.headers['x-webhook-secret'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!igual(segredo, CFG.webhookSecret)) return res.status(401).json({ erro: 'nao_autorizado' });

  // Flush das ocorrências informativas: o gateway cutuca este mesmo endpoint (~60s) com
  // o header x-ocorrencias-flush. Isolado e idempotente — não afeta o fluxo de mensagens.
  // (Fica aqui porque o Vercel Hobby limita a 12 funções e não cabe uma rota nova.)
  if (req.headers['x-ocorrencias-flush']) {
    try {
      const flush = await flushOcorrenciasEnviadas({ limite: 150 });
      return res.status(200).json({ ok: true, flush });
    } catch (e) {
      return res.status(200).json({ ok: false, erro: String(e.message || e).slice(0, 200) });
    }
  }

  const status = await processarEntrada(req.body || {}, { canal: 'whatsapp' });
  return res.status(200).json({ status });
}
