import { supabase, hojeSP, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enfileirar, agendadoParaHoje } from './fila.js';

/**
 * Régua de AVISOS (lembrete de aula, preventiva). Na véspera, lembra o aluno da aula do dia
 * seguinte — sem cobrança. Alvo configurável: só quem está em risco (card de evasão nível 1/2)
 * ou todos com aula. A opção "todos" é travada ao master (gate no endpoint).
 * Variáveis do texto: {aluno} {curso} {dia_semana} {horario} {turma}
 * Passo 1: config + prévia (sem envio). O enfileiramento entra no passo 2.
 */

export const AVISO_PADRAO = {
  ativa: false,
  horario: 18,          // hora de envio (véspera, à noite)
  pula_domingo: true,
  alvo: 'risco12',      // 'risco1' | 'risco2' | 'risco12' | 'todos'
  texto: 'Oi, {aluno}! 😊 Passando pra lembrar: sua aula de {curso} é {dia_semana} às {horario} (turma {turma}). Te esperamos! Se não puder vir, é só responder aqui que a gente te ajuda. 💙'
};

const ALVOS = ['risco1', 'risco2', 'risco12', 'todos'];

export function mesclarAviso(salva) {
  const base = JSON.parse(JSON.stringify(AVISO_PADRAO));
  if (!salva || typeof salva !== 'object') return base;
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    pula_domingo: salva.pula_domingo !== false,
    alvo: ALVOS.includes(salva.alvo) ? salva.alvo : base.alvo,
    texto: typeof salva.texto === 'string' && salva.texto.trim() ? salva.texto.slice(0, 1000) : base.texto
  };
}

export async function avisoDaUnidade(unitId) {
  const { data } = await supabase.from('units').select('regua_aviso').eq('id', unitId).maybeSingle();
  return mesclarAviso(data?.regua_aviso);
}

function somaDias(iso, d) {
  const x = new Date(`${iso}T12:00:00-03:00`);
  x.setDate(x.getDate() + d);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(x));
}
export const amanhaSP = () => somaDias(hojeSP(), 1);
const ehDomingoISO = (iso) => new Date(`${iso}T12:00:00-03:00`).getUTCDay() === 0;
// Próxima data de aula a avisar (véspera). Normalmente amanhã; se amanhã for domingo
// (sem aula e sem cron), pula para segunda — ou seja, o SÁBADO cobre a segunda.
export const proximaDataAula = () => {
  const am = amanhaSP();
  return ehDomingoISO(am) ? somaDias(hojeSP(), 2) : am;
};

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';

/** Preenche o texto do aviso (usado no envio — passo 2). */
export function preencherAviso(texto, a) {
  return String(texto || '').replace(/\{(aluno|curso|dia_semana|horario|turma)\}/g, (_, k) => {
    if (k === 'aluno') return primeiroNome(a.nome_aluno);
    if (k === 'curso') return String(a.curso || 'seu curso');
    if (k === 'dia_semana') return String(a.dia_semana || '');
    if (k === 'horario') return String(a.horario || '');
    if (k === 'turma') return String(a.turma || '');
    return '';
  });
}

/** cod_alus com card de risco de evasão aberto, pelos níveis pedidos. */
async function codAlusEmRisco(unitId, niveis) {
  const statuses = [];
  if (niveis.includes(1)) statuses.push('risco_evasao_1');
  if (niveis.includes(2)) statuses.push('risco_evasao_2');
  if (!statuses.length) return new Set();
  const { data } = await supabase.from('cards').select('cod_alu').eq('unit_id', unitId).in('status', statuses);
  return new Set((data || []).map((c) => String(c.cod_alu)).filter(Boolean));
}

/** Aplica o alvo (risco/todos) sobre a lista de quem tem aula. */
async function filtrarPorAlvo(unitId, roster, alvo) {
  if (alvo === 'todos') return roster;
  const niveis = alvo === 'risco1' ? [1] : alvo === 'risco2' ? [2] : [1, 2];
  const emRisco = await codAlusEmRisco(unitId, niveis);
  return roster.filter((a) => emRisco.has(String(a.cod_alu)));
}

/**
 * Prévia (SEM envio): quem receberia o lembrete numa data (padrão: amanhã).
 * Telefone preferencial = do ALUNO; cai no do responsável se faltar.
 */
export async function previaAviso(unitId, { dataIso = null } = {}) {
  const cfg = await avisoDaUnidade(unitId);
  const data = dataIso || amanhaSP();
  const lista = await ponte(unitId, 'alunos_com_aula', { data }, { timeoutMs: 40000 });
  const roster = (lista || []).filter((a) => digitos(a.telefone_aluno || a.telefone_responsavel || '').length >= 10);

  const comAlvo = await filtrarPorAlvo(unitId, roster, cfg.alvo);

  // 1 aluno = 1 mensagem (mesmo com 2 aulas no dia). Agrupa por cod_alu.
  const porAluno = new Map();
  for (const a of comAlvo) {
    const k = a.cod_alu || digitos(a.telefone_aluno || a.telefone_responsavel);
    if (!porAluno.has(k)) porAluno.set(k, a);
  }
  const amostra = [...porAluno.values()].slice(0, 25).map((a) => ({
    aluno: primeiroNome(a.nome_aluno),
    curso: a.curso,
    turma: a.turma,
    dia_semana: a.dia_semana,
    horario: a.horario,
    para_aluno: !!digitos(a.telefone_aluno || '').length
  }));

  const totalComAula = new Set(roster.map((r) => r.cod_alu || digitos(r.telefone_aluno || r.telefone_responsavel))).size;
  return {
    data,
    alvo: cfg.alvo,
    total_com_aula: totalComAula,     // todos que têm aula nesse dia (com telefone)
    total_alvo: porAluno.size,        // quantos receberiam, pelo alvo configurado
    amostra
  };
}

/**
 * Processa a régua de avisos de uma unidade (padrão: próxima data de aula) e ENFILEIRA
 * o lembrete — 1 mensagem por aluno (a aula mais cedo do dia), no celular do aluno
 * (fallback responsável). O gateway envia no horário configurado. Dedup por chave.
 */
export async function processarAvisoUnidade(unitId, { dataIso = null, forcar = false } = {}) {
  const cfg = await avisoDaUnidade(unitId);
  const resumo = { unit_id: unitId, com_aula: 0, alvo: 0, enfileiradas: 0 };
  if (!cfg.ativa && !forcar) return { ...resumo, pulou: 'inativa' };

  const data = dataIso || proximaDataAula();
  let lista;
  try {
    lista = await ponte(unitId, 'alunos_com_aula', { data }, { timeoutMs: 40000 });
  } catch (e) {
    await registrar('avisos', 'ponte_erro', false, { unitId, detalhe: { erro: e.message, data } });
    return { ...resumo, erro: e.codigo || e.message };
  }
  const roster = (lista || []).filter((a) => digitos(a.telefone_aluno || a.telefone_responsavel || '').length >= 10);
  resumo.com_aula = new Set(roster.map((r) => r.cod_alu)).size;

  const comAlvo = await filtrarPorAlvo(unitId, roster, cfg.alvo);

  // 1 mensagem por aluno: entre as aulas do dia, usa a mais cedo (menor horário).
  const porAluno = new Map();
  for (const a of comAlvo) {
    const k = a.cod_alu || digitos(a.telefone_aluno || a.telefone_responsavel);
    const atual = porAluno.get(k);
    if (!atual || String(a.horario) < String(atual.horario)) porAluno.set(k, a);
  }
  resumo.alvo = porAluno.size;

  const agendado = agendadoParaHoje(cfg.horario);
  const itens = [];
  for (const [k, a] of porAluno) {
    const telAluno = digitos(a.telefone_aluno || '');
    const paraAluno = telAluno.length >= 10;
    const telefone = paraAluno ? a.telefone_aluno : a.telefone_responsavel;
    itens.push({
      telefone,
      texto: preencherAviso(cfg.texto, a),
      origem: 'regua_aviso',
      categoria: 'lembrete_aula',
      prioridade: 5,
      agendado_para: agendado,
      chave: `aviso|${data}|${k}`,
      cod_alu: a.cod_alu,
      alunos: primeiroNome(a.nome_aluno),
      metadata: { turma: a.turma, curso: a.curso, dia_semana: a.dia_semana, horario: a.horario, para: paraAluno ? 'aluno' : 'responsavel' }
    });
  }
  resumo.enfileiradas = await enfileirar(unitId, itens);
  await registrar('avisos', 'enfileirar', true, { unitId, detalhe: { ...resumo, data } });
  return { ...resumo, data };
}
