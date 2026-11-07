import { supabase, hojeSP, digitos, registrar } from './base.js';

/**
 * Fila única de disparos. O Vercel enfileira aqui; o gateway (always-on) drena
 * respeitando agendado_para (horário da unidade) e o ritmo humanizado.
 */

/** ISO de hoje às HH:00 no horário de São Paulo (quando a mensagem pode sair). */
export function agendadoParaHoje(horario) {
  const h = String(Math.max(0, Math.min(23, Number(horario) || 9))).padStart(2, '0');
  return `${hojeSP()}T${h}:00:00-03:00`;
}

/**
 * Enfileira itens para uma unidade (dedup por chave; não duplica o que já está na fila).
 * item: { telefone, texto, origem, categoria, prioridade, agendado_para, chave, cod_alu, alunos }
 */
export async function enfileirar(unitId, itens) {
  const lista = (itens || []).filter((i) => i && i.telefone && i.texto && digitos(i.telefone).length >= 10);
  if (!lista.length) return 0;

  const chaves = lista.map((i) => i.chave).filter(Boolean);
  const existentes = new Set();
  for (let i = 0; i < chaves.length; i += 200) {
    const { data } = await supabase.from('fila_mensagens').select('chave')
      .eq('unit_id', unitId).in('chave', chaves.slice(i, i + 200)).neq('status', 'cancelado');
    (data || []).forEach((r) => existentes.add(r.chave));
  }

  const novos = lista
    .filter((i) => !i.chave || !existentes.has(i.chave))
    .map((i) => ({
      unit_id: unitId,
      telefone: digitos(i.telefone),
      texto: String(i.texto).slice(0, 4000),
      origem: i.origem || 'regua',
      categoria: i.categoria || null,
      prioridade: Number.isInteger(i.prioridade) ? i.prioridade : 5,
      chave: i.chave || null,
      agendado_para: i.agendado_para || new Date().toISOString(),
      cod_alu: i.cod_alu || null,
      alunos: i.alunos || null
    }));
  if (!novos.length) return 0;

  const { data, error } = await supabase.from('fila_mensagens').insert(novos).select('id');
  if (error) {
    await registrar('fila', 'enfileirar_erro', false, { unitId, detalhe: { erro: error.message } });
    return 0;
  }
  return data?.length || 0;
}
