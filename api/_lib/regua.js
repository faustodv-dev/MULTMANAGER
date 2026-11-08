import { supabase, reais, dataBr, hojeSP, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enviarWhatsapp } from './gateway.js';
import { enfileirar, agendadoParaHoje } from './fila.js';

/**
 * Régua de cobrança (disparo automático e manual de mensagens no WhatsApp).
 * O envio é fire-and-forget: o gateway enfileira e humaniza (digitação + espaçamento),
 * então o chip fica protegido e a função não trava esperando entrega.
 * Variáveis dos textos: {responsavel} {aluno} {valor} {vencimento}
 */

export const STATUS_CANONICOS = ['Ativo', 'Desistente', 'Rescindido', 'Trancado', 'Formado'];

export const REGUA_PADRAO = {
  ativa: false,
  horario: 9,
  pula_domingo: true,
  statuses: ['Ativo'],
  via_fila: false, // false = envio direto (atual); true = enfileira e o gateway envia (hora real + ocorrência)
  passos: [
    { offset: -3, ativo: true, texto: 'Oi, {responsavel}! 😊 Passando pra lembrar que a mensalidade de {aluno} ({valor}) vence em {vencimento}. Pagando até o vencimento você garante o desconto de pontualidade. Se quiser o boleto ou o Pix, é só responder aqui que eu te mando!' },
    { offset: 0, ativo: true, texto: 'Olá, {responsavel}! A mensalidade de {aluno} ({valor}) vence hoje ({vencimento}). Dá pra pagar por boleto ou Pix — me responde aqui que eu envio na hora. 😉' },
    { offset: 1, ativo: true, texto: 'Oi, {responsavel}! Vi que a mensalidade de {aluno}, com vencimento em {vencimento}, ficou em aberto. Acontece! Quer que eu gere a segunda via por boleto ou Pix (já com o valor atualizado)? É só responder aqui. 🙂' },
    { offset: 7, ativo: true, texto: 'Olá, {responsavel}! A mensalidade de {aluno} venceu em {vencimento} e segue em aberto. Posso te enviar o boleto já com o valor atualizado ou o Pix agora mesmo — responde aqui que a gente resolve juntos. 😊' },
    { offset: 15, ativo: true, texto: 'Oi, {responsavel}. A mensalidade de {aluno} está vencida desde {vencimento}. Pra evitar que o débito aumente, vamos resolver? Me responde aqui que eu te mando o boleto atualizado ou o Pix, ou combino um prazo com você.' },
    { offset: 30, ativo: true, texto: 'Olá, {responsavel}. A mensalidade de {aluno} está em aberto há cerca de 30 dias (desde {vencimento}). Precisamos regularizar para manter a matrícula em dia. Me responde aqui hoje que eu te ajudo com o pagamento ou com um acordo. 🙏' }
  ]
};

export function rotuloOffset(o) {
  const n = Math.abs(Number(o));
  if (o < 0) return `${n} dia${n > 1 ? 's' : ''} antes de vencer`;
  if (o === 0) return 'no dia do vencimento';
  return `${n} dia${n > 1 ? 's' : ''} depois de vencer`;
}

export function mesclarRegua(salva) {
  const base = JSON.parse(JSON.stringify(REGUA_PADRAO));
  if (!salva || typeof salva !== 'object') return base;
  const salvos = Array.isArray(salva.passos) ? salva.passos : [];
  const porOffset = new Map(salvos.map((p) => [Number(p.offset), p]));
  const passos = base.passos.map((p) => {
    const s = porOffset.get(p.offset);
    return s ? { offset: p.offset, ativo: s.ativo !== false, texto: String(s.texto || p.texto) } : p;
  });
  for (const s of salvos) {
    const off = Number(s.offset);
    if (Number.isInteger(off) && !base.passos.some((p) => p.offset === off) && s.texto) {
      passos.push({ offset: off, ativo: s.ativo !== false, texto: String(s.texto) });
    }
  }
  passos.sort((a, b) => a.offset - b.offset);
  let statuses = Array.isArray(salva.statuses) ? salva.statuses.map((x) => String(x).trim()).filter(Boolean) : [];
  if (!statuses.length) statuses = [...base.statuses];
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    pula_domingo: salva.pula_domingo !== false,
    via_fila: salva.via_fila === true,
    statuses,
    passos
  };
}

export async function reguaDaUnidade(unitId) {
  const { data } = await supabase.from('units').select('regua').eq('id', unitId).maybeSingle();
  return mesclarRegua(data?.regua);
}

function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + dias);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(d));
}

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';

export function nomesAlunos(lista) {
  const nomes = [...new Set((lista || []).map((n) => primeiroNome(n)).filter(Boolean))];
  if (nomes.length <= 2) return nomes.join(' e ');
  return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
}

export function preencher(texto, vars) {
  return String(texto || '').replace(/\{(responsavel|aluno|valor|vencimento)\}/g, (_, k) => (vars[k] ?? ''));
}

export function preencherDemo(texto) {
  return preencher(texto, { responsavel: 'Maria', aluno: 'João', valor: 'R$ 150,00', vencimento: dataBr(hojeSP()) });
}

const MAX_POR_EXECUCAO = 250; // teto de segurança por chamada (cabe no limite da Vercel)

/**
 * Processa uma lista já agrupada (um grupo = uma mensagem por responsável).
 * Pré-carrega os já-enviados e os boletos ativos (2 consultas) para rodar rápido;
 * o índice único (unit_id, chave) é a garantia final contra duplicidade.
 * Envia fire-and-forget (o gateway humaniza). Retorna o relatório.
 */
async function processarGrupos(unitId, gruposMap, origem, { viaFila = false, horario = 9 } = {}) {
  const grupos = [...gruposMap.values()];
  const resumo = { total: grupos.length, enviados: 0, pulados: 0, erros: 0, limitado: false, via_fila: !!viaFila, erros_detalhe: [] };
  if (!grupos.length) return resumo;
  const filaItens = [];
  const agendado = agendadoParaHoje(horario);

  // Pré-carrega já-enviados (por chave) e boletos ativos (por cod_par)
  const chaves = grupos.map((g) => g.chave);
  const enviadosSet = new Set();
  for (let i = 0; i < chaves.length; i += 200) {
    const { data } = await supabase.from('regua_envios').select('chave').eq('unit_id', unitId).in('chave', chaves.slice(i, i + 200));
    (data || []).forEach((r) => enviadosSet.add(r.chave));
  }
  const { data: cobr } = await supabase.from('cobrancas_asaas').select('cod_pars').eq('unit_id', unitId).in('status', ['pendente', 'recebido']);
  const boletoSet = new Set();
  (cobr || []).forEach((c) => (c.cod_pars || []).forEach((p) => boletoSet.add(Number(p))));

  const registros = [];
  let processados = 0;
  for (const g of grupos) {
    if (processados >= MAX_POR_EXECUCAO) { resumo.limitado = true; break; }
    if (enviadosSet.has(g.chave)) { resumo.pulados++; continue; }
    processados++;
    const alunosTxt = nomesAlunos(g._alunos);
    const baseReg = {
      unit_id: unitId, chave: g.chave, offset_dias: g.passo.offset, vencimento: g.vencimento || null,
      telefone: digitos(g.telefone), cod_pars: g.cod_pars, alunos: alunosTxt, valor_centavos: g.valor, origem
    };
    if (g.cod_pars.some((p) => boletoSet.has(Number(p)))) {
      resumo.pulados++;
      registros.push({ ...baseReg, status: 'pulado_boleto_ativo' });
      continue;
    }
    const texto = preencher(g.passo.texto, {
      responsavel: primeiroNome(g.responsavel) || 'tudo bem', aluno: alunosTxt, valor: reais(g.valor), vencimento: dataBr(g.vencimento)
    });
    if (viaFila) {
      // Enfileira: o gateway envia no horário da unidade, grava a hora REAL e dispara a ocorrência.
      filaItens.push({
        telefone: g.telefone, texto, origem: 'regua_cobranca', categoria: `cob${g.passo.offset}`,
        prioridade: 5, agendado_para: agendado, chave: `cob|${g.chave}`,
        cod_alu: g.cod_alu, alunos: alunosTxt, metadata: { matricula: g.matricula || '', offset: g.passo.offset }
      });
      resumo.enviados++;
      registros.push({ ...baseReg, status: 'enfileirado' });
    } else {
      const env = await enviarWhatsapp(unitId, g.telefone, texto, { conversaId: null, aguardarEntrega: false });
      if (env.ok || env.status === 'simulado') {
        resumo.enviados++;
        registros.push({ ...baseReg, status: env.status === 'simulado' ? 'simulado' : 'enviado' });
      } else {
        resumo.erros++;
        if (resumo.erros_detalhe.length < 50) resumo.erros_detalhe.push({ telefone: digitos(g.telefone), aluno: alunosTxt, erro: env.erro || 'falha no envio' });
      }
    }
  }
  if (viaFila && filaItens.length) await enfileirar(unitId, filaItens);
  if (registros.length) {
    await supabase.from('regua_envios').upsert(registros, { onConflict: 'unit_id,chave', ignoreDuplicates: true }).then(() => {}, () => {});
  }
  await registrar('regua', origem === 'manual' ? 'manual' : 'disparo', resumo.erros === 0, { unitId, detalhe: { total: resumo.total, enviados: resumo.enviados, pulados: resumo.pulados, erros: resumo.erros, limitado: resumo.limitado } });
  return resumo;
}

/** Monta os grupos (uma msg por responsável) a partir da carteira. escolherPasso(parcela)->passo ou null. */
function agrupar(carteira, escolherPasso, chaveDe) {
  const grupos = new Map();
  for (const p of carteira) {
    const passo = escolherPasso(p);
    if (!passo) continue;
    const tel = digitos(p.telefone);
    const chave = chaveDe(passo, p, tel);
    if (!grupos.has(chave)) grupos.set(chave, { chave, passo, telefone: p.telefone, vencimento: p.vencimento, responsavel: p.nome_responsavel || '', _alunos: [], cod_pars: [], valor: 0, cod_alu: p.cod_alu || null, matricula: p.num_matricula || '' });
    const g = grupos.get(chave);
    g._alunos.push(p.nome_aluno); g.cod_pars.push(p.cod_par); g.valor += Number(p.valor || 0);
    if (p.vencimento && (!g.vencimento || p.vencimento < g.vencimento)) g.vencimento = p.vencimento;
    if (!g.responsavel && p.nome_responsavel) g.responsavel = p.nome_responsavel;
  }
  return grupos;
}

/** Disparo AUTOMÁTICO de uma unidade. */
export async function processarReguaUnidade(unitId, { forcar = false } = {}) {
  const regua = await reguaDaUnidade(unitId);
  if (!regua.ativa && !forcar) return { unit_id: unitId, total: 0, enviados: 0, pulados: 0, erros: 0, pulou: 'inativa' };
  const passos = regua.passos.filter((p) => p.ativo);
  if (!passos.length) return { unit_id: unitId, total: 0, enviados: 0, pulados: 0, erros: 0, pulou: 'sem_passos' };

  const hoje = hojeSP();
  const porData = new Map(passos.map((p) => [somaDias(hoje, -p.offset), p]));
  let carteira;
  try {
    carteira = await ponte(unitId, 'carteira', { datas: [...porData.keys()], statuses: regua.statuses }, { timeoutMs: 40000 });
  } catch (e) {
    await registrar('regua', 'carteira_erro', false, { unitId, detalhe: { erro: e.message } });
    return { unit_id: unitId, total: 0, enviados: 0, pulados: 0, erros: 1, erro: e.codigo || e.message };
  }
  carteira = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);
  const grupos = agrupar(carteira, (p) => porData.get(p.vencimento), (passo, p, tel) => `${passo.offset}|${p.vencimento}|${tel}`);
  const r = await processarGrupos(unitId, grupos, 'auto', { viaFila: regua.via_fila, horario: regua.horario });
  return { unit_id: unitId, ...r };
}

/** Prévia do disparo MANUAL: quantos responsáveis/parcelas entram, sem enviar nada. */
export async function previaManual(unitId, { de, ate, statuses }) {
  const carteira = await ponte(unitId, 'carteira', { de, ate, statuses }, { timeoutMs: 40000 });
  const comTel = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);
  const tels = new Set(comTel.map((p) => digitos(p.telefone)));
  return {
    responsaveis: tels.size,
    parcelas: comTel.length,
    sem_telefone: (carteira || []).length - comTel.length,
    valor_total: comTel.reduce((s, p) => s + Number(p.valor || 0), 0)
  };
}

/**
 * Disparo MANUAL com relatório (job). Enfileira todos (lotes geridos pelo gateway),
 * grava um regua_jobs com o resultado e devolve o relatório.
 */
export async function dispararManual(unitId, { de, ate, statuses, offset, criadoPor = null }) {
  const regua = await reguaDaUnidade(unitId);
  const passo = regua.passos.find((p) => Number(p.offset) === Number(offset)) || regua.passos[0];

  const { data: job } = await supabase.from('regua_jobs').insert({
    unit_id: unitId, criado_por: criadoPor, tipo: 'manual',
    params: { de, ate, offset: passo.offset, statuses }, status: 'processando'
  }).select('id').single();
  const jobId = job?.id || null;

  let resumo;
  try {
    const carteira = await ponte(unitId, 'carteira', { de, ate, statuses }, { timeoutMs: 40000 });
    const lista = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);
    const grupos = agrupar(lista, () => passo, (_passo, _p, tel) => `M|${tel}|${passo.offset}|${de}|${ate}`);
    resumo = await processarGrupos(unitId, grupos, 'manual', { viaFila: regua.via_fila, horario: regua.horario });
  } catch (e) {
    resumo = { total: 0, enviados: 0, pulados: 0, erros: 1, limitado: false, erros_detalhe: [{ erro: e.message }] };
  }

  if (jobId) {
    await supabase.from('regua_jobs').update({
      total: resumo.total, enviados: resumo.enviados, pulados: resumo.pulados, erros: resumo.erros,
      erros_detalhe: resumo.erros_detalhe, status: resumo.limitado ? 'parcial' : (resumo.erros ? 'concluido_com_erros' : 'concluido'),
      finalizado_em: new Date().toISOString()
    }).eq('id', jobId).then(() => {}, () => {});
  }
  return { job_id: jobId, resumo };
}
