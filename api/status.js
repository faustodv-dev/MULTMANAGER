import { usuarioDaRequisicao } from './_lib/base.js';
import { CFG } from './_lib/base.js';
import { ponte } from './_lib/ponte.js';
import { segredosUnidade } from './_lib/conversa.js';

/** Diagnóstico para o master: configuração, ponte e gateway. */
export default async function handler(req, res) {
  const eu = await usuarioDaRequisicao(req);
  if (!eu || eu.papel !== 'master') return res.status(403).json({ erro: 'sem_permissao' });
  const unidade = String(req.query?.unidade || 'rio_verde');
  const segredos = await segredosUnidade(unidade).catch(() => ({}));
  const r = {
    config: {
      supabase: !!CFG.supabaseServiceKey, ponte: !!(CFG.ponteUrl && CFG.ponteSegredo), gateway: !!(CFG.gatewayUrl && CFG.gatewayKey),
      webhook_secret: !!CFG.webhookSecret, gemini: !!CFG.geminiKey, groq: !!CFG.groqKey,
      asaas_chave_unidade: !!segredos.asaas, asaas_webhook_token: !!CFG.asaasWebhookToken,
      cron_secret: !!CFG.cronSecret, asaas_sandbox: CFG.asaasSandbox
    }
  };
  try {
    r.ponte = await ponte(unidade, 'ping', {});
  } catch (e) {
    r.ponte = { erro: e.codigo, mensagem: e.message, detalhes: e.detalhes };
  }
  try {
    const g = await fetch(`${CFG.gatewayUrl}/health`, { signal: AbortSignal.timeout(8000) });
    r.gateway = { http: g.status };
  } catch (e) {
    r.gateway = { erro: e.message };
  }
  return res.status(200).json(r);
}
