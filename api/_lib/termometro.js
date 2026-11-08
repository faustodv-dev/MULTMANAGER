import { supabase } from './base.js';

/**
 * Termômetro do Aluno (4d) — mede numericamente o engajamento (quente/morno/frio).
 * Roda SÓ para quem já está no fluxo (faltantes do dia / atendimento) — sem varredura geral.
 * Frio → abre card em Risco de Evasão (4c). Os sinais positivos AMACIAM (menos falso-positivo).
 *
 * Pesos abaixo são o ponto de partida aprovado — fáceis de calibrar depois.
 */

const PESOS = {
  base: 100,
  por_falta_seguida: 22,      // -22 por falta consecutiva
  presenca_limite: 80,        // abaixo disso, penaliza
  presenca_fator: 0.6,        // -(limite - %)*fator
  justificou: 18,             // +
  reposicao: 18,              // + (tem reposição recente)
  nota_boa: 15, nota_media: 6, nota_limite_boa: 7, nota_limite_media: 5,
  respondeu_wpp: 12, ignorou_wpp: 12,
  apostila: 5
};

const FAIXA_QUENTE = 70; // >= 70 quente; 40..69 morno; < 40 frio
const FAIXA_MORNO = 40;

/** Calcula a temperatura a partir dos sinais disponíveis (todos opcionais exceto faltas). */
export function calcularTemperatura(s = {}) {
  let score = PESOS.base;
  const motivos = [];

  const fs = Number(s.faltas_seguidas || 0);
  if (fs > 0) { score -= fs * PESOS.por_falta_seguida; motivos.push(`${fs} falta${fs > 1 ? 's' : ''} seguida${fs > 1 ? 's' : ''}`); }

  if (s.percentual_presenca != null && Number(s.percentual_presenca) < PESOS.presenca_limite) {
    const pct = Number(s.percentual_presenca);
    score -= Math.round((PESOS.presenca_limite - pct) * PESOS.presenca_fator);
    motivos.push(`presença ${pct}%`);
  }

  if (s.tem_justificativa) { score += PESOS.justificou; motivos.push('justificou a falta'); }
  if (Number(s.reposicoes || 0) > 0) { score += PESOS.reposicao; motivos.push('está repondo aula'); }

  if (s.media_notas != null) {
    const m = Number(s.media_notas);
    if (m >= PESOS.nota_limite_boa) { score += PESOS.nota_boa; motivos.push(`média ${m}`); }
    else if (m >= PESOS.nota_limite_media) { score += PESOS.nota_media; motivos.push(`média ${m}`); }
    else { motivos.push(`média baixa ${m}`); }
  }

  if (s.respondeu_whatsapp === true) { score += PESOS.respondeu_wpp; motivos.push('responde no WhatsApp'); }
  else if (s.respondeu_whatsapp === false) { score -= PESOS.ignorou_wpp; motivos.push('não responde no WhatsApp'); }

  if (s.apostila_entregue) { score += PESOS.apostila; }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const faixa = score >= FAIXA_QUENTE ? 'quente' : score >= FAIXA_MORNO ? 'morno' : 'frio';
  return { score, faixa, motivos };
}

export const emojiFaixa = (f) => (f === 'quente' ? '🔥' : f === 'morno' ? '🙂' : '🧊');

/** Grava/atualiza a última temperatura do aluno (lido pelo card e pelo Atendimento). */
export async function upsertTemperatura(unitId, codAlu, matricula, resultado, sinais) {
  if (!unitId || !codAlu) return;
  await supabase.from('aluno_termometro').upsert({
    unit_id: unitId, cod_alu: String(codAlu), matricula: matricula || null,
    score: resultado.score, faixa: resultado.faixa, motivos: resultado.motivos,
    sinais: sinais || null, atualizado_em: new Date().toISOString()
  }, { onConflict: 'unit_id,cod_alu' }).then(() => {}, () => {});
}

/** Abre (ou escala) um card de Risco de Evasão para o aluno, sem duplicar. */
export async function abrirCardRiscoEvasao(unitId, { cod_alu, nome, telefone, nivel, descricao }) {
  if (!unitId || !cod_alu) return null;
  const status = Number(nivel) === 2 ? 'risco_evasao_2' : 'risco_evasao_1';
  const { data: aberto } = await supabase.from('cards').select('id,status')
    .eq('unit_id', unitId).eq('cod_alu', String(cod_alu)).eq('departamento', 'pedagogico')
    .in('status', ['risco_evasao_1', 'risco_evasao_2']).order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  if (aberto) {
    if (aberto.status !== status) {
      await supabase.from('cards').update({ status, updated_at: new Date().toISOString() }).eq('id', aberto.id).then(() => {}, () => {});
    }
    return aberto.id;
  }
  const { data } = await supabase.from('cards').insert({
    unit_id: unitId, departamento: 'pedagogico', cod_alu: String(cod_alu),
    nome_aluno: nome || null, telefone: telefone || null,
    titulo: `Risco de evasão - ${nome || cod_alu}`,
    descricao: String(descricao || '').slice(0, 500),
    status, prioridade: 'alta', canal_origem: 'sistema'
  }).select('id').single();
  if (data) await supabase.from('card_eventos').insert({
    card_id: data.id, unit_id: unitId, departamento: 'pedagogico', tipo: 'sistema',
    descricao: 'Card aberto pelo termômetro (risco de evasão)'
  }).then(() => {}, () => {});
  return data?.id || null;
}

/**
 * Avalia um faltante do dia: calcula a temperatura, grava, e se FRIO abre o card
 * (Risco de Evasão 2 para 3+ faltas seguidas, 1 para as demais frias).
 * Retorna a faixa para o chamador contabilizar.
 */
export async function avaliarFaltante(unitId, f) {
  const sinais = {
    faltas_seguidas: Number(f.faltas_seguidas || 0),
    percentual_presenca: f.percentual_presenca != null ? Number(f.percentual_presenca) : null,
    tem_justificativa: !!f.tem_justificativa,
    reposicoes: Number(f.reposicoes || 0),
    media_notas: f.media_notas != null ? Number(f.media_notas) : null
  };
  const r = calcularTemperatura(sinais);
  await upsertTemperatura(unitId, f.cod_alu, f.matricula, r, sinais);
  if (r.faixa === 'frio') {
    const nivel = sinais.faltas_seguidas >= 3 ? 2 : 1;
    await abrirCardRiscoEvasao(unitId, {
      cod_alu: f.cod_alu, nome: f.nome_aluno || f.nome, telefone: f.telefone, nivel,
      descricao: `${emojiFaixa(r.faixa)} Frio (${r.score}/100) — ${r.motivos.join(', ')}.`
    });
  }
  return r.faixa;
}
