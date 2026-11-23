import { supabase, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enfileirar, agendadoParaHoje } from './fila.js';
import { resumoDiarioDaUnidade, unidadeTemDiario } from './diario.js';

/**
 * Régua de BOLETIM MENSAL (pedagógico). Roda no dia 01 (guard no cron), cobre o mês que
 * fechou e sai por TEXTO na fila — 1 mensagem por responsável, com um bloco por aluno ativo.
 * Dados em UMA leitura batch da ponte (boletim_mes) + 1 agregado do Diário por unidade.
 * Dedup por chave `boletim|AAAA-MM|telefone` → mesmo rodando todo dia, só sai 1x no mês.
 * Cabeçalho e rodapé são editáveis; as linhas de dados são geradas (sempre corretas).
 */

export const BOLETIM_PADRAO = {
  ativa: false,
  horario: 9,
  dia: 1,
  statuses: ['Ativo'],
  cabecalho: 'Olá, {responsavel}! 👋 Aqui é a MULT Profissões com o resumo de {mes} de {aluno_poss}.',
  rodape: 'Qualquer dúvida sobre frequência, notas ou reposição, é só responder aqui. 💙',
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';
const valorBr = (v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(1).replace('.', ','));
const nomeMes = (mesIso) => MESES[Number(String(mesIso).slice(5, 7)) - 1] || '';

export function mesclarBoletim(salva) {
  const base = JSON.parse(JSON.stringify(BOLETIM_PADRAO));
  if (!salva || typeof salva !== 'object') return base;
  let statuses = Array.isArray(salva.statuses) ? salva.statuses.map((x) => String(x).trim()).filter(Boolean) : [];
  if (!statuses.length) statuses = [...base.statuses];
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    dia: Number.isInteger(salva.dia) ? Math.min(28, Math.max(1, salva.dia)) : base.dia,
    statuses,
    cabecalho: String(salva.cabecalho || base.cabecalho).slice(0, 600),
    rodape: String(salva.rodape || base.rodape).slice(0, 600),
  };
}

export async function boletimDaUnidade(unitId) {
  const { data } = await supabase.from('units').select('regua_boletim').eq('id', unitId).maybeSingle();
  return mesclarBoletim(data?.regua_boletim);
}

/** Mês-alvo padrão = o mês que fechou (mês anterior, fuso SP), no formato AAAA-MM. */
export function mesQueFechou(ref = new Date()) {
  const sp = new Date(ref.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  sp.setDate(1);
  sp.setMonth(sp.getMonth() - 1);
  return `${sp.getFullYear()}-${String(sp.getMonth() + 1).padStart(2, '0')}`;
}

/** Linha de dados de um aluno (frequência do mês + % no curso + notas + diário). */
function blocoAluno(a, mesNm, diarioMap) {
  const linhas = [];
  const aulas = (a.presencas_mes || 0) + (a.faltas_mes || 0);
  if (aulas > 0) {
    const faltou = a.faltas_mes > 0 ? ` (faltou ${a.faltas_mes})` : '';
    const pct = a.percentual_presenca != null ? ` · frequência no curso: ${Math.round(Math.min(a.percentual_presenca, 100))}%` : '';
    linhas.push(`• Presença em ${mesNm}: ${a.presencas_mes} de ${aulas} aulas${faltou}${pct}`);
  } else if (a.percentual_presenca != null) {
    linhas.push(`• Frequência no curso: ${Math.round(Math.min(a.percentual_presenca, 100))}%`);
  }
  const notas = a.notas_mes || [];
  if (notas.length) {
    const n = notas.map((x) => `${x.modulos ? x.modulos + ' — ' : ''}${x.criterio} ${valorBr(x.valor)}`).join('; ');
    linhas.push(`• Notas novas: ${n}`);
  }
  const d = diarioMap[String(a.cod_alu)];
  if (d && d.missoes > 0) {
    linhas.push(`• Diário de Bordo: ${d.missoes} ${d.missoes === 1 ? 'missão' : 'missões'}, ${d.xp} XP 🚀`);
  }
  if (!linhas.length) return null; // aluno sem nada no mês → não entra
  return `*${primeiroNome(a.nome_aluno)} — ${a.curso || 'seu curso'}*\n${linhas.join('\n')}`;
}

// 1 bloco por aluno: escolhe a matrícula com mais atividade no mês (ou maior frequência).
function porAluno(alunos) {
  const m = new Map();
  for (const a of alunos) {
    if (!a.telefone || digitos(a.telefone).length < 10) continue;
    const atual = m.get(a.cod_alu);
    const ativ = (a.presencas_mes || 0) + (a.faltas_mes || 0) + (a.notas_mes?.length || 0);
    const ativAtual = atual ? (atual.presencas_mes || 0) + (atual.faltas_mes || 0) + (atual.notas_mes?.length || 0) : -1;
    if (!atual || ativ > ativAtual || (ativ === ativAtual && Number(a.percentual_presenca || 0) > Number(atual.percentual_presenca || 0))) {
      m.set(a.cod_alu, a);
    }
  }
  return [...m.values()];
}

// Agrupa por telefone (responsável) → monta a mensagem com um bloco por aluno.
function montarMensagens(alunos, cfg, mesIso, diarioMap) {
  const mesNm = nomeMes(mesIso);
  const porTel = new Map();
  for (const a of porAluno(alunos)) {
    const tel = digitos(a.telefone);
    if (!porTel.has(tel)) porTel.set(tel, { telefone: a.telefone, responsavel: a.nome_responsavel, alunos: [] });
    porTel.get(tel).alunos.push(a);
  }
  const msgs = [];
  for (const [tel, g] of porTel) {
    const blocos = g.alunos.map((a) => blocoAluno(a, mesNm, diarioMap)).filter(Boolean);
    if (!blocos.length) continue;
    const nomesAlunos = g.alunos.map((a) => primeiroNome(a.nome_aluno)).filter(Boolean);
    const alunoPoss = nomesAlunos.length === 1 ? nomesAlunos[0] : nomesAlunos.slice(0, -1).join(', ') + ' e ' + nomesAlunos.slice(-1);
    const cabecalho = String(cfg.cabecalho)
      .replace(/\{responsavel\}/g, primeiroNome(g.responsavel) || 'tudo bem')
      .replace(/\{mes\}/g, mesNm)
      .replace(/\{aluno_poss\}/g, alunoPoss || 'seu aluno');
    const texto = `${cabecalho}\n\n${blocos.join('\n\n')}\n\n${cfg.rodape}`.slice(0, 3500);
    msgs.push({ telefone: g.telefone, texto, tel, qtd_alunos: g.alunos.length });
  }
  return msgs;
}

/** Prévia (SEM envio): quantos responsáveis/alunos e uma amostra de mensagem. */
export async function previaBoletim(unitId, mes) {
  const cfg = await boletimDaUnidade(unitId);
  const mesIso = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : mesQueFechou();
  const r = await ponte(unitId, 'boletim_mes', { mes: mesIso, statuses: cfg.statuses }, { timeoutMs: 45000 });
  const diarioMap = unidadeTemDiario(unitId) ? await resumoDiarioDaUnidade(unitId).catch(() => ({})) : {};
  const msgs = montarMensagens(r?.alunos || [], cfg, mesIso, diarioMap);
  const totalAlunos = msgs.reduce((s, m) => s + m.qtd_alunos, 0);
  return { mes: mesIso, responsaveis: msgs.length, alunos: totalAlunos, amostra: msgs.slice(0, 3).map((m) => m.texto) };
}

/** Processa a régua de boletim e ENFILEIRA. Dedup por chave `boletim|mes|telefone`. */
export async function processarBoletimUnidade(unitId, { mes = null, forcar = false } = {}) {
  const cfg = await boletimDaUnidade(unitId);
  const mesIso = /^\d{4}-\d{2}$/.test(String(mes || '')) ? mes : mesQueFechou();
  const resumo = { unit_id: unitId, mes: mesIso, responsaveis: 0, enfileiradas: 0 };
  if (!cfg.ativa && !forcar) return { ...resumo, pulou: 'inativa' };

  let r;
  try {
    r = await ponte(unitId, 'boletim_mes', { mes: mesIso, statuses: cfg.statuses }, { timeoutMs: 45000 });
  } catch (e) {
    await registrar('boletim', 'ponte_erro', false, { unitId, detalhe: { erro: e.message } });
    return { ...resumo, erro: e.codigo || e.message };
  }
  const diarioMap = unidadeTemDiario(unitId) ? await resumoDiarioDaUnidade(unitId).catch(() => ({})) : {};
  const msgs = montarMensagens(r?.alunos || [], cfg, mesIso, diarioMap);
  resumo.responsaveis = msgs.length;

  const agendado = agendadoParaHoje(cfg.horario);
  const itens = msgs.map((m) => ({
    telefone: m.telefone,
    texto: m.texto,
    origem: 'regua_boletim',
    categoria: 'boletim',
    prioridade: 7,
    agendado_para: agendado,
    chave: `boletim|${mesIso}|${m.tel}`,
    metadata: { mes: mesIso, alunos: m.qtd_alunos },
  }));
  resumo.enfileiradas = await enfileirar(unitId, itens);
  await registrar('boletim', 'enfileirar', true, { unitId, detalhe: { ...resumo } });
  return resumo;
}
