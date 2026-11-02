import crypto from 'crypto';
import { CFG, registrar } from './base.js';
import { simulando } from './contexto.js';

// No simulador, estas ações não gravam nada no sistema escolar
const ESCRITAS = ['baixar', 'registrar_ocorrencia', 'agendar_pagamento', 'registrar_carta'];

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
  if (simulando() && ESCRITAS.includes(acao)) {
    await registrar('ponte', `${acao} (simulado)`, true, { unitId: unidade, conversaId, detalhe: { params } });
    if (acao === 'baixar') {
      const sim = await ponte(unidade, 'simular_baixa', params, { conversaId, timeoutMs });
      return { ...sim, baixado: true, simulado: true };
    }
    if (acao === 'agendar_pagamento') return { agendamento_id: 0, simulado: true };
    if (acao === 'registrar_carta') return { cod_hist: 0, simulado: true };
    return { cod_oco: 0, simulado: true };
  }
  const corpo = JSON.stringify({ ...params, acao, unidade });
  const ts = String(Math.floor(Date.now() / 1000));
  const assinatura = crypto.createHmac('sha256', CFG.ponteSegredo).update(`${ts}.${corpo}`).digest('hex');
  const inicio = Date.now();
  let resp;
  let json = null;
  let texto = '';
  try {
    resp = await fetch(CFG.ponteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ponte-Ts': ts, 'X-Ponte-Assinatura': assinatura },
      body: corpo,
      signal: AbortSignal.timeout(timeoutMs)
    });
    texto = await resp.text();
    json = parseJsonTolerante(texto); // extrai o JSON mesmo se o PHP imprimir um warning antes
  } catch (e) {
    await registrar('ponte', acao, false, { unitId: unidade, conversaId, duracaoMs: Date.now() - inicio, detalhe: { erro: e.message } });
    throw new ErroPonte('ponte_indisponivel', 'Não foi possível falar com o sistema escolar.');
  }
  const ok = !!json?.ok;
  // Não registra o PDF inteiro
  const resumo = ok && acao === 'carne' ? { arquivo: json.dados?.arquivo } : ok ? undefined : json;
  await registrar('ponte', acao, ok, { unitId: unidade, conversaId, duracaoMs: Date.now() - inicio, detalhe: resumo ? { resposta: resumo, http: resp.status } : { http: resp.status } });
  if (!ok) {
    const det = json?.detalhes || (!json && texto ? { resposta_bruta: texto.slice(0, 400) } : {});
    throw new ErroPonte(json?.erro || `http_${resp.status}`, json?.mensagem || 'Erro na ponte', det, resp.status);
  }
  return json.dados;
}

/** Converte a resposta em JSON mesmo que o PHP tenha impresso algo (warning) antes/depois. */
function parseJsonTolerante(texto) {
  if (!texto) return null;
  try { return JSON.parse(texto); } catch {}
  const i = texto.indexOf('{');
  const j = texto.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(texto.slice(i, j + 1)); } catch {} }
  return null;
}
