import { supabase, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enfileirar, agendadoParaHoje } from './fila.js';

/**
 * Régua de FORMANDO (pedagógico → comercial). Roda em paralelo à régua de faltantes,
 * pegando carona na frequência: quando o aluno cruza um limiar (80% garante o certificado),
 * entra num funil de mensagens — felicitação → reta final → indicação → conclusão.
 * Cada etapa dispara UMA vez por aluno (dedup pela chave da fila). A cada rodada o aluno
 * recebe a etapa de MAIOR limiar que ele alcança e ainda não recebeu.
 * Variáveis dos textos: {aluno} {curso} {presenca}
 */

export const FORMANDO_PADRAO = {
  ativa: false,
  horario: 10,
  statuses: ['Ativo'],
  etapas: [
    { id: 'felicitacao', ativo: true, limiar: 80, texto: '🎉 Parabéns, {aluno}! Você bateu {presenca}% de presença em {curso} — ou seja, seu CERTIFICADO está garantido! Que orgulho da sua dedicação. 💙 Segue firme até o fim pra aproveitar tudo que a MULT tem pra você!' },
    { id: 'reta_final', ativo: true, limiar: 90, texto: 'Oi, {aluno}! 🚀 Você já passou dos 90% de presença em {curso} — tá na reta final! Falta pouco pra concluir com chave de ouro. Bora juntos até o fim?' },
    { id: 'indicacao', ativo: true, limiar: 95, texto: '{aluno}, você é exemplo de dedicação em {curso}! 🌟 Que tal trazer um amigo pra transformar a vida dele também? Indique alguém que se matricular e você ganha um BÔNUS especial. Me chama aqui que eu te explico! 😉' },
    { id: 'conclusao', ativo: true, limiar: 100, texto: '🏆 {aluno}, você concluiu {curso} com presença máxima — que jornada! Como formando(a), você tem condições especiais pra emplacar o próximo curso e sair na frente no mercado. E nossa Agência de Emprego já pode te encaminhar pras vagas. Bora pro próximo passo? Me chama! 🎓' }
  ]
};

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';

export function mesclarFormando(salva) {
  const base = JSON.parse(JSON.stringify(FORMANDO_PADRAO));
  if (!salva || typeof salva !== 'object') return base;
  const salvas = Array.isArray(salva.etapas) ? salva.etapas : [];
  const etapas = base.etapas.map((e) => {
    const s = salvas.find((x) => x.id === e.id);
    if (!s) return e;
    const limiar = Number.isFinite(+s.limiar) ? Math.min(100, Math.max(1, Math.round(+s.limiar))) : e.limiar;
    return { id: e.id, ativo: s.ativo !== false, limiar, texto: String(s.texto || e.texto).slice(0, 1000) };
  });
  let statuses = Array.isArray(salva.statuses) ? salva.statuses.map((x) => String(x).trim()).filter(Boolean) : [];
  if (!statuses.length) statuses = [...base.statuses];
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    statuses,
    etapas
  };
}

export async function formandoDaUnidade(unitId) {
  const { data } = await supabase.from('units').select('regua_formando').eq('id', unitId).maybeSingle();
  return mesclarFormando(data?.regua_formando);
}

function preencher(texto, f) {
  return String(texto || '').replace(/\{(aluno|curso|presenca)\}/g, (_, k) => {
    if (k === 'aluno') return primeiroNome(f.nome_aluno);
    if (k === 'curso') return String(f.curso || 'seu curso');
    if (k === 'presenca') return String(Math.round(Number(f.percentual_presenca || 0)));
    return '';
  });
}

const etapasAtivasOrdenadas = (cfg) => cfg.etapas.filter((e) => e.ativo !== false).sort((a, b) => b.limiar - a.limiar);

// 1 aluno = 1 linha (a matrícula de maior frequência).
function porAlunoMaiorFreq(lista) {
  const m = new Map();
  for (const f of lista) {
    const k = f.cod_alu ? 'a' + f.cod_alu : 't' + digitos(f.telefone);
    const atual = m.get(k);
    if (!atual || Number(f.percentual_presenca || 0) > Number(atual.percentual_presenca || 0)) m.set(k, f);
  }
  return m;
}

async function puxarFormandos(unitId, cfg) {
  const ativas = etapasAtivasOrdenadas(cfg);
  const minLimiar = ativas.length ? Math.min(...ativas.map((e) => e.limiar)) : 80;
  const lista = await ponte(unitId, 'formandos', { statuses: cfg.statuses, min_pct: minLimiar }, { timeoutMs: 45000 });
  return (lista || []).filter((f) => f.telefone && digitos(f.telefone).length >= 10);
}

/** Prévia (SEM envio): população atual por etapa. */
export async function previaFormando(unitId) {
  const cfg = await formandoDaUnidade(unitId);
  const ativas = etapasAtivasOrdenadas(cfg);
  const comTel = await puxarFormandos(unitId, cfg);
  const porAluno = porAlunoMaiorFreq(comTel);
  const por_etapa = {};
  for (const e of ativas) por_etapa[e.id] = 0;
  const amostra = [];
  for (const f of porAluno.values()) {
    const pct = Number(f.percentual_presenca || 0);
    const etapa = ativas.find((e) => pct >= e.limiar);
    if (!etapa) continue;
    por_etapa[etapa.id] = (por_etapa[etapa.id] || 0) + 1;
    if (amostra.length < 25) amostra.push({ aluno: primeiroNome(f.nome_aluno), curso: f.curso, presenca: f.percentual_presenca, etapa: etapa.id });
  }
  return { total: porAluno.size, por_etapa, amostra };
}

/** Processa a régua de formando e ENFILEIRA. Dedup por chave `formando|etapa|aluno`. */
export async function processarFormandoUnidade(unitId, { forcar = false } = {}) {
  const cfg = await formandoDaUnidade(unitId);
  const resumo = { unit_id: unitId, formandos: 0, enfileiradas: 0 };
  if (!cfg.ativa && !forcar) return { ...resumo, pulou: 'inativa' };
  const ativas = etapasAtivasOrdenadas(cfg);
  if (!ativas.length) return { ...resumo, pulou: 'sem_etapas' };

  let comTel;
  try {
    comTel = await puxarFormandos(unitId, cfg);
  } catch (e) {
    await registrar('formandos', 'ponte_erro', false, { unitId, detalhe: { erro: e.message } });
    return { ...resumo, erro: e.codigo || e.message };
  }
  const porAluno = porAlunoMaiorFreq(comTel);
  resumo.formandos = porAluno.size;

  const agendado = agendadoParaHoje(cfg.horario);
  const itens = [];
  for (const [k, f] of porAluno) {
    const pct = Number(f.percentual_presenca || 0);
    const etapa = ativas.find((e) => pct >= e.limiar); // a de MAIOR limiar que ele alcança
    if (!etapa) continue;
    itens.push({
      telefone: f.telefone,
      texto: preencher(etapa.texto, f),
      origem: 'regua_formando',
      categoria: etapa.id,
      prioridade: 6,
      agendado_para: agendado,
      chave: `formando|${etapa.id}|${k}`,
      cod_alu: f.cod_alu,
      alunos: primeiroNome(f.nome_aluno),
      metadata: { etapa: etapa.id, curso: f.curso, turma: f.turma, presenca: f.percentual_presenca, media_notas: f.media_notas }
    });
  }
  resumo.enfileiradas = await enfileirar(unitId, itens);
  await registrar('formandos', 'enfileirar', true, { unitId, detalhe: { ...resumo } });
  return resumo;
}
