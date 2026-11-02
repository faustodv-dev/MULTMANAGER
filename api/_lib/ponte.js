import crypto from 'crypto';
import { CFG, registrar } from './base.js';

export class ErroPonte extends Error {
  constructor(codigo, mensagem, detalhes = {}, http = 0) {
    super(mensagem || codigo);
    this.codigo = codigo;
    this.detalhes = detalhes;
    this.http = http;
  }
}

/**
 * Chama a ponte PHP no servidor do sistema escolar (assinatura HMAC).
 * Lança ErroPonte com o código de negócio quando a ponte recusa.
 */
export async function ponte(unidade, acao, params = {}, { conversaId = null, timeoutMs = 20000 } = {}) {
  if (!CFG.ponteUrl || !CFG.ponteSegredo) throw new ErroPonte('ponte_nao_configurada', 'PONTE_URL/PONTE_SEGREDO ausentes');
  const corpo = JSON.stringify({ ...params, acao, unidade });
  const ts = String(Math.floor(Date.now() / 1000));
  const assinatura = crypto.createHmac('sha256', CFG.ponteSegredo).update(`${ts}.${corpo}`).digest('hex');
  const inicio = Date.now();
  let resp;
  let json = null;
  try {
    resp = await fetch(CFG.ponteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ponte-Ts': ts, 'X-Ponte-Assinatura': assinatura },
      body: corpo,
      signal: AbortSignal.timeout(timeoutMs)
    });
    json = await resp.json().catch(() => null);
  } catch (e) {
    await registrar('ponte', acao, false, { unitId: unidade, conversaId, duracaoMs: Date.now() - inicio, detalhe: { erro: e.message } });
    throw new ErroPonte('ponte_indisponivel', 'Não foi possível falar com o sistema escolar.');
  }
  const ok = !!json?.ok;
  // Não registra o PDF inteiro
  const resumo = ok && acao === 'carne' ? { arquivo: json.dados?.arquivo } : ok ? undefined : json;
  await registrar('ponte', acao, ok, { unitId: unidade, conversaId, duracaoMs: Date.now() - inicio, detalhe: resumo ? { resposta: resumo, http: resp.status } : { http: resp.status } });
  if (!ok) {
    throw new ErroPonte(json?.erro || `http_${resp.status}`, json?.mensagem || 'Erro na ponte', json?.detalhes || {}, resp.status);
  }
  return json.dados;
}
