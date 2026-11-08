import { supabase, hojeSP, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enfileirar, agendadoParaHoje } from './fila.js';
import { avaliarFaltante } from './termometro.js';

/**
 * Régua de faltantes (pedagógica). Lê os faltantes do dia pela ponte, escolhe a etapa
 * pela quantidade de faltas seguidas (com pré-verificação de justificativa) e enfileira
 * a mensagem. Quando o aluno responde, o agente pedagógico já construído assume.
 * Variáveis dos textos: {aluno} {responsavel} {curso}
 */

export const FALTANTES_PADRAO = {
  ativa: false,
  horario: 9,
  pula_domingo: true,
  statuses: ['Ativo'],
  pre_verificar_justificativa: true,
  etapas: [
    { id: 'justificada', ativo: true, texto: 'Olá, {aluno}! 😊 Vimos que você justificou sua ausência — esperamos que esteja tudo bem! Pra você não perder o módulo prático de {curso}, posso já deixar sua reposição agendada? Fica melhor esta semana ou no sábado?' },
    { id: 'falta1', ativo: true, texto: 'Oi, {aluno}! Sentimos sua falta na aula de {curso} ontem! Está tudo bem com você? A turma avançou na prática e não queremos que você fique pra trás. Me conta por aqui o que aconteceu que já organizo sua reposição rápida, combinado?' },
    { id: 'consec2', ativo: true, texto: 'Olá, {aluno}! Fiquei um pouco preocupada: você acumulou 2 ausências seguidas em {curso}. Pra garantir seu certificado e as indicações de vagas de emprego, a presença mínima é de 80%. O que houve? Me responde hoje pra agendarmos suas reposições e não prejudicar sua formação!' },
    { id: 'consec3', ativo: true, texto: 'Prezado(a) {aluno}, aqui é da Coordenação Pedagógica da MULT, sobre o curso de {curso}. Constatamos 3 ausências consecutivas, e o acúmulo de faltas compromete sua matrícula. ⚠️ Pedimos que você (ou seu responsável) compareça à secretaria em até 48h pra alinharmos seu plano de reposição. Se teve um imprevisto grave, me responde com urgência por aqui!' }
  ]
};

const porId = (etapas, id) => etapas.find((e) => e.id === id) || null;

export function mesclarFaltantes(salva) {
  const base = JSON.parse(JSON.stringify(FALTANTES_PADRAO));
  if (!salva || typeof salva !== 'object') return base;
  const salvas = Array.isArray(salva.etapas) ? salva.etapas : [];
  const etapas = base.etapas.map((e) => {
    const s = salvas.find((x) => x.id === e.id);
    return s ? { id: e.id, ativo: s.ativo !== false, texto: String(s.texto || e.texto) } : e;
  });
  let statuses = Array.isArray(salva.statuses) ? salva.statuses.map((x) => String(x).trim()).filter(Boolean) : [];
  if (!statuses.length) statuses = [...base.statuses];
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    pula_domingo: salva.pula_domingo !== false,
    pre_verificar_justificativa: salva.pre_verificar_justificativa !== false,
    statuses,
    etapas
  };
}

export async function faltantesDaUnidade(unitId) {
  const { data } = await supabase.from('units').select('regua_faltantes').eq('id', unitId).maybeSingle();
  return mesclarFaltantes(data?.regua_faltantes);
}

function somaDias(iso, d) {
  const x = new Date(`${iso}T12:00:00-03:00`);
  x.setDate(x.getDate() + d);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(x));
}
export const ontemSP = () => somaDias(hojeSP(), -1);

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';

function escolherEtapa(f, cfg) {
  if (f.tem_justificativa && cfg.pre_verificar_justificativa) return porId(cfg.etapas, 'justificada');
  const s = Number(f.faltas_seguidas || 0);
  if (s >= 3) return porId(cfg.etapas, 'consec3');
  if (s === 2) return porId(cfg.etapas, 'consec2');
  return porId(cfg.etapas, 'falta1');
}

function preencher(texto, f) {
  return String(texto || '').replace(/\{(aluno|responsavel|curso)\}/g, (_, k) => {
    if (k === 'aluno') return primeiroNome(f.nome_aluno);
    if (k === 'responsavel') return primeiroNome(f.nome_responsavel) || primeiroNome(f.nome_aluno);
    if (k === 'curso') return String(f.curso || 'seu curso');
    return '';
  });
}

/** Processa os faltantes de uma unidade para um dia (padrão: ontem) e enfileira. */
export async function processarFaltantesUnidade(unitId, { dataIso = null, forcar = false } = {}) {
  const cfg = await faltantesDaUnidade(unitId);
  const resumo = { unit_id: unitId, faltantes: 0, enfileiradas: 0, puladas_justificadas: 0 };
  if (!cfg.ativa && !forcar) return { ...resumo, pulou: 'inativa' };

  const data = dataIso || ontemSP();
  let faltantes;
  try {
    faltantes = await ponte(unitId, 'faltantes_do_dia', { data, statuses: cfg.statuses }, { timeoutMs: 40000 });
  } catch (e) {
    await registrar('faltantes', 'ponte_erro', false, { unitId, detalhe: { erro: e.message, data } });
    return { ...resumo, erro: e.codigo || e.message };
  }
  faltantes = (faltantes || []).filter((f) => f.telefone && digitos(f.telefone).length >= 10);
  resumo.faltantes = faltantes.length;

  // Termômetro (4d): avalia cada faltante (reusa este lote), grava a temperatura e,
  // se FRIO, abre/escala o card de Risco de Evasão. Em paralelo; não trava o envio.
  try {
    const faixas = await Promise.all(faltantes.map((f) => avaliarFaltante(unitId, f).catch(() => null)));
    resumo.frios = faixas.filter((x) => x === 'frio').length;
  } catch { /* termômetro é best-effort, não impede a régua */ }

  const agendado = agendadoParaHoje(cfg.horario);
  const itens = [];
  for (const f of faltantes) {
    const etapa = escolherEtapa(f, cfg);
    if (!etapa || etapa.ativo === false) continue;
    if (etapa.id === 'justificada') resumo.puladas_justificadas++;
    itens.push({
      telefone: f.telefone,
      texto: preencher(etapa.texto, f),
      origem: 'regua_faltantes',
      categoria: etapa.id,
      prioridade: 4,
      agendado_para: agendado,
      // Chave POR ALUNO: irmãos no mesmo celular do responsável geram um alerta cada
      // (nomeando o aluno certo). Só deduplica o MESMO aluno (ex.: 2 turmas / re-run do dia).
      chave: `falt|${etapa.id}|${data}|${f.cod_alu ? 'a' + f.cod_alu : 't' + digitos(f.telefone)}`,
      cod_alu: f.cod_alu,
      alunos: primeiroNome(f.nome_aluno),
      metadata: { matricula: f.matricula ? String(f.matricula) : '', etapa: etapa.id }
    });
  }
  resumo.enfileiradas = await enfileirar(unitId, itens);
  await registrar('faltantes', 'enfileirar', true, { unitId, detalhe: { ...resumo, data } });
  return { ...resumo, data };
}

/** Prévia: quantos faltantes entrariam, sem enfileirar. */
export async function previaFaltantes(unitId, { dataIso = null } = {}) {
  const cfg = await faltantesDaUnidade(unitId);
  const data = dataIso || ontemSP();
  const faltantes = await ponte(unitId, 'faltantes_do_dia', { data, statuses: cfg.statuses }, { timeoutMs: 40000 });
  const comTel = (faltantes || []).filter((f) => f.telefone && digitos(f.telefone).length >= 10);
  const porEtapa = { justificada: 0, falta1: 0, consec2: 0, consec3: 0 };
  for (const f of comTel) {
    const e = escolherEtapa(f, cfg);
    if (e) porEtapa[e.id] = (porEtapa[e.id] || 0) + 1;
  }
  return { data, total: comTel.length, por_etapa: porEtapa };
}
