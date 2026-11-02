import { CFG, registrar } from './base.js';

const base = () => (CFG.asaasSandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');

function headers(chave) {
  // Remove espaços/quebras que podem vir coladas na chave (senão o fetch recusa o header).
  return { access_token: String(chave || '').replace(/\s+/g, ''), 'Content-Type': 'application/json', 'User-Agent': 'mult-crm-financeiro' };
}

async function get(chave, caminho, params, unitId) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const inicio = Date.now();
  const r = await fetch(`${base()}${caminho}?${qs}`, { headers: headers(chave), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  await registrar('asaas', 'GET ' + caminho, r.ok, { unitId, duracaoMs: Date.now() - inicio, detalhe: r.ok ? { total: j?.totalCount } : { http: r.status, erro: j?.errors?.[0]?.description } });
  if (!r.ok) throw new Error(j?.errors?.[0]?.description || `asaas_http_${r.status}`);
  return j;
}

async function metodo(verbo, chave, caminho, corpo, unitId) {
  const inicio = Date.now();
  const r = await fetch(`${base()}${caminho}`, {
    method: verbo, headers: headers(chave), body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(20000)
  });
  const j = await r.json().catch(() => ({}));
  await registrar('asaas', `${verbo} ${caminho}`, r.ok, { unitId, duracaoMs: Date.now() - inicio, detalhe: r.ok ? { id: j?.id } : { http: r.status, erro: j?.errors?.[0]?.description } });
  if (!r.ok) {
    const e = new Error(j?.errors?.[0]?.description || `asaas_http_${r.status}`);
    e.http = r.status;
    e.asaas = j?.errors;
    throw e;
  }
  return j;
}

const centavos = (v) => Math.round(Number(v || 0) * 100);
const reais = (c) => Math.round(Number(c || 0)) / 100;
const soDigitos = (s) => String(s || '').replace(/\D+/g, '');

/**
 * Cliente Asaas do responsável: procura pelo CPF; se não existir, cria.
 * notificationDisabled = true: todo controle de cobrança é nosso (sem e-mail/SMS do Asaas).
 */
export async function garantirCliente(chave, { nome, cpf, telefone, email, unitId }) {
  const doc = soDigitos(cpf);
  const lista = await get(chave, '/customers', { cpfCnpj: doc, limit: 100 }, unitId);
  const existente = (lista.data || []).find((c) => soDigitos(c.cpfCnpj) === doc);
  if (existente) {
    if (!existente.notificationDisabled) {
      await metodo('POST', chave, `/customers/${existente.id}`, { notificationDisabled: true }, unitId).catch(() => {});
    }
    return existente.id;
  }
  const criado = await metodo('POST', chave, '/customers', {
    name: nome, cpfCnpj: doc, mobilePhone: soDigitos(telefone) || undefined, email: email || undefined,
    notificationDisabled: true
  }, unitId);
  return criado.id;
}

/**
 * Cria a cobrança (boleto + Pix na mesma cobrança). Opção A: valor fechado,
 * sem desconto/juros/multa automáticos do Asaas — o valor é o calculado pela ponte.
 */
export async function criarCobranca(chave, { customer, valorCentavos, vencimento, descricao, externalReference, unitId }) {
  return metodo('POST', chave, '/payments', {
    customer,
    billingType: 'UNDEFINED', // deixa o pagador escolher boleto ou Pix
    value: reais(valorCentavos),
    dueDate: vencimento,
    description: String(descricao || '').slice(0, 500),
    externalReference,
    daysAfterDueDateToRegistrationCancellation: 30
  }, unitId);
}

/** Linha digitável do boleto e QR/copia-e-cola do Pix (cada um pode falhar isolado). */
export async function detalhesPagamento(chave, paymentId, unitId) {
  const out = {};
  try {
    const b = await get(chave, `/payments/${paymentId}/identificationField`, {}, unitId);
    out.linha_digitavel = b?.identificationField || null;
  } catch {}
  try {
    const p = await get(chave, `/payments/${paymentId}/pixQrCode`, {}, unitId);
    out.pix_copia_cola = p?.payload || null;
  } catch {}
  return out;
}

/** Remove uma cobrança não paga (aluno pagou na escola). */
export async function excluirCobranca(chave, paymentId, unitId) {
  return metodo('DELETE', chave, `/payments/${paymentId}`, null, unitId);
}

/** Situação atual de uma cobrança no Asaas. */
export async function obterCobranca(chave, paymentId, unitId) {
  return get(chave, `/payments/${paymentId}`, {}, unitId);
}

/**
 * Procura no extrato da conta Asaas um crédito Pix com o valor do comprovante,
 * na data do pagamento (± 1 dia). Se o comprovante tiver o código fim-a-fim (E2E),
 * ele é usado para confirmar. `ignorarIds` evita usar o mesmo crédito duas vezes.
 *
 * Retorna { status: 'encontrado'|'nao_encontrado'|'ambiguo', transacao? }
 */
export async function procurarPixRecebido(chave, { valorCentavos, data, endToEndId, ignorarIds = [], unitId }) {
  const d = new Date(`${data}T12:00:00-03:00`);
  const fmt = (x) => x.toISOString().slice(0, 10);
  const inicio = fmt(new Date(d.getTime() - 86400000));
  const fim = fmt(new Date(d.getTime() + 86400000));

  // 1) Pelo E2E nas transações Pix, quando o comprovante traz o código
  if (endToEndId) {
    try {
      const pix = await get(chave, '/pix/transactions', { endToEndIdentifier: endToEndId }, unitId);
      const t = (pix.data || []).find((x) => String(x.endToEndIdentifier || '') === endToEndId);
      if (t && centavos(Math.abs(t.value)) === valorCentavos && !ignorarIds.includes(t.id)) {
        return { status: 'encontrado', transacao: { id: t.id, valor: centavos(t.value), data: t.effectiveDate || t.dateCreated, e2e: endToEndId, origem: 'pix' } };
      }
    } catch {
      // segue para o extrato
    }
  }

  // 2) Pelos Pix recebidos (créditos concluídos) com o mesmo valor e data
  try {
    const recebidos = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const j = await get(chave, '/pix/transactions', { type: 'CREDIT', status: 'DONE', offset, limit: 100 }, unitId);
      const pagina = j.data || [];
      recebidos.push(...pagina);
      const maisAntigo = pagina.map((t) => String(t.effectiveDate || t.dateCreated || '').slice(0, 10)).sort()[0];
      if (!j.hasMore || (maisAntigo && maisAntigo < inicio)) break;
    }
    const iguais = recebidos.filter((t) => {
      const dia = String(t.effectiveDate || t.dateCreated || '').slice(0, 10);
      return centavos(Math.abs(t.value)) === valorCentavos && dia >= inicio && dia <= fim && !ignorarIds.includes(t.id);
    });
    if (iguais.length === 1) {
      const t = iguais[0];
      return { status: 'encontrado', transacao: { id: t.id, valor: centavos(t.value), data: t.effectiveDate || t.dateCreated, e2e: t.endToEndIdentifier || null, origem: 'pix_lista' } };
    }
    if (iguais.length > 1) return { status: 'ambiguo', quantidade: iguais.length };
  } catch {
    // segue para o extrato
  }

  // 3) Pelo extrato: créditos do mesmo valor no período
  const lista = [];
  let offset = 0;
  for (let i = 0; i < 10; i++) {
    const j = await get(chave, '/financialTransactions', { startDate: inicio, finishDate: fim, offset, limit: 100 }, unitId);
    lista.push(...(j.data || []));
    if (!j.hasMore) break;
    offset += 100;
  }
  const candidatos = lista.filter(
    (t) => Number(t.value) > 0 && centavos(t.value) === valorCentavos && !ignorarIds.includes(t.id) &&
      /PIX|PAYMENT_RECEIVED|RECEIVABLE/i.test(String(t.type || '') + ' ' + String(t.description || ''))
  );
  if (candidatos.length === 1) {
    const t = candidatos[0];
    return { status: 'encontrado', transacao: { id: t.id, valor: centavos(t.value), data: t.date, descricao: t.description, origem: 'extrato' } };
  }
  if (candidatos.length > 1) return { status: 'ambiguo', quantidade: candidatos.length };
  return { status: 'nao_encontrado' };
}
