import { CFG, igual, faltandoConfig } from './_lib/base.js';
import { processarEntrada } from './_lib/entrada.js';

export const config = { maxDuration: 60 };

/** Recebe as mensagens do gateway (Render/Baileys) e responde pelo agente financeiro. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });

  const faltando = faltandoConfig(['supabaseUrl', 'supabaseServiceKey', 'webhookSecret', 'gatewayUrl', 'gatewayKey']);
  if (faltando.length) return res.status(500).json({ erro: 'config_ausente', faltando });

  const segredo = req.headers['x-webhook-secret'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!igual(segredo, CFG.webhookSecret)) return res.status(401).json({ erro: 'nao_autorizado' });

  const status = await processarEntrada(req.body || {}, { canal: 'whatsapp' });
  return res.status(200).json({ status });
}
