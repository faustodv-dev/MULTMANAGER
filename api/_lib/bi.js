import { supabase, registrar, hojeSP } from './base.js';
import { ponte } from './ponte.js';

// Métricas do v1. A lista é aberta: para plugar inadimplência/encaminhados/novas,
// basta acrescentar a chave aqui no cálculo — o jsonb de bi_snapshots não muda de schema.
export const METRICAS = [
  { id: 'frequencia_media', rotulo: 'Frequência média', sufixo: '%', melhor: 'alto' },
  { id: 'matriculas_ativas', rotulo: 'Matrículas ativas', sufixo: '', melhor: 'alto' },
  { id: 'novas_mes', rotulo: 'Novas no mês', sufixo: '', melhor: 'alto' },
  { id: 'formandos_80', rotulo: 'Formandos (≥80%)', sufixo: '', melhor: 'alto' },
  { id: 'evasao_total', rotulo: 'Risco de evasão', sufixo: '', melhor: 'baixo' },
];

/** Monta o jsonb de métricas de uma unidade: pedagógico da ponte + evasão do CRM. */
async function metricasDaUnidade(unitId) {
  const r = await ponte(unitId, 'resumo_bi', {}, {});
  const { data: risco } = await supabase.from('cards').select('status')
    .eq('unit_id', unitId).eq('departamento', 'pedagogico')
    .in('status', ['risco_evasao_1', 'risco_evasao_2']);
  const n1 = (risco || []).filter((c) => c.status === 'risco_evasao_1').length;
  const n2 = (risco || []).filter((c) => c.status === 'risco_evasao_2').length;
  return {
    frequencia_media: r.frequencia_media ?? 0,
    matriculas_ativas: r.matriculas_ativas ?? 0,
    novas_mes: r.novas_mes ?? 0,
    formandos_80: r.formandos_80 ?? 0,
    evasao_total: n1 + n2,
    evasao_n1: n1,
    evasao_n2: n2,
  };
}

/**
 * Snapshot diário de BI de todas as unidades (dobrado no cron reconciliar — Hobby
 * só permite 2 crons). Upsert por (unit_id, data): rodar de novo no mesmo dia
 * apenas atualiza. Nunca lança — devolve o resumo para o chamador registrar.
 */
export async function rodarSnapshotBi(data) {
  const dia = data || hojeSP();
  const { data: units } = await supabase.from('units').select('id');
  const resumo = { dia, feitos: 0, erros: 0, unidades: (units || []).length };
  for (const u of (units || [])) {
    try {
      const metricas = await metricasDaUnidade(u.id);
      const { error } = await supabase.from('bi_snapshots')
        .upsert({ unit_id: u.id, data: dia, metricas, criado_em: new Date().toISOString() }, { onConflict: 'unit_id,data' });
      if (error) throw new Error(error.message);
      resumo.feitos++;
    } catch (e) {
      resumo.erros++;
      await registrar('bi', 'snapshot_erro', false, { unitId: u.id, detalhe: { erro: e.message } });
    }
  }
  await registrar('bi', 'snapshot', true, { detalhe: resumo });
  return resumo;
}
