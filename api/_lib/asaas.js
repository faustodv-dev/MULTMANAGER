import { CFG, registrar } from './base.js';

const base = () => (CFG.asaasSandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3');

async function get(chave, caminho, params, unitId) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const inicio = Date.now();
  const r = await fetch(`${base()}${caminho}?${qs}`, {
    headers: { access_token: chave, 'User-Agent': 'mult-crm-financeiro' },
    signal: AbortSignal.timeout(15000)
  });
  const j = await r.json().catch(() => ({}));
  await registrar('asaas', caminho, r.ok, { unitId, duracaoMs: Date.now() - inicio, detalhe: r.ok ? { total: j?.totalCount } : { http: r.status, erro: j?.errors?.[0]?.description } });
  if (!r.ok) throw new Error(j?.errors?.[0]?.description || `asaas_http_${r.status}`);
  return j;
}

const centavos = (v) => Math.round(Number(v || 0) * 100);

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
