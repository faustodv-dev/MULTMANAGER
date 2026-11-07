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

  // Dedup DENTRO do lote: a constraint é UNIQUE (unit_id, chave), então duas linhas
  // com a mesma chave (ex.: mesmo telefone/etapa/dia — aluno em 2 turmas ou irmãos no
  // mesmo celular) derrubariam o insert inteiro. Mantém a primeira de cada chave.
  const vistas = new Set();
  const unicos = lista.filter((i) => {
    if (!i.chave) return true;
    if (vistas.has(i.chave)) return false;
    vistas.add(i.chave);
    return true;
  });

  // Dedup contra o que já está na fila (não reenviar o que já foi enfileirado).
  const chaves = [...vistas];
  const existentes = new Set();
  for (let i = 0; i < chaves.length; i += 200) {
    const { data } = await supabase.from('fila_mensagens').select('chave')
      .eq('unit_id', unitId).in('chave', chaves.slice(i, i + 200)).neq('status', 'cancelado');
    (data || []).forEach((r) => existentes.add(r.chave));
  }

  const novos = unicos
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
      alunos: i.alunos || null,
      metadata: i.metadata || null
    }));
  if (!novos.length) return 0;

  const { data, error } = await supabase.from('fila_mensagens').insert(novos).select('id');
  if (!error) return data?.length || 0;

  // Resiliência: se ainda assim colidir (corrida/chave repetida solta), não perde o lote.
  // Insere linha a linha e ignora só as que a constraint rejeitar.
  if (/duplicate key|unique/i.test(error.message || '')) {
    let ok = 0;
    for (const n of novos) {
      const r = await supabase.from('fila_mensagens').insert(n).select('id');
      if (!r.error) ok += r.data?.length || 0;
      else if (!/duplicate key|unique/i.test(r.error.message || '')) {
        await registrar('fila', 'enfileirar_erro', false, { unitId, detalhe: { erro: r.error.message } });
      }
    }
    return ok;
  }

  await registrar('fila', 'enfileirar_erro', false, { unitId, detalhe: { erro: error.message } });
  return 0;
}
