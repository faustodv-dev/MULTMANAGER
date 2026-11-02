import { supabase } from './base.js';
import { simulando } from './contexto.js';

/**
 * Integração do atendimento por WhatsApp com o Kanban do CRM.
 * Regra: um card é aberto quando a conversa precisa de gente (handoff/pendência),
 * nunca para conversas 100% resolvidas pela IA. O card se move sozinho conforme
 * de quem é a vez: contato escreveu → "Em andamento"; secretaria respondeu → "Aguardando aluno".
 * No simulador nada é gravado.
 */

const DEP = 'financeiro'; // por ora o atendimento do WhatsApp é financeiro

/** Card aberto (não finalizado) ligado a esta conversa, se houver. */
export async function cardDeConversa(conversa) {
  const { data } = await supabase.from('cards').select('*')
    .eq('unit_id', conversa.unit_id).eq('conversa_id', conversa.id).neq('status', 'resolvido')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

/** Garante que existe um card aberto para a conversa; cria se não houver. */
export async function garantirCardWhatsapp(conversa, { titulo, status = 'andamento', prioridade } = {}) {
  if (simulando()) return null;
  const codAlu = (conversa.cod_alus || [])[0] || null;
  const atual = await cardDeConversa(conversa);
  if (atual) {
    const patch = {};
    if (status && atual.status !== status) patch.status = status;
    if (prioridade && atual.prioridade !== prioridade) patch.prioridade = prioridade;
    if (codAlu && !atual.cod_alu) patch.cod_alu = codAlu;
    if (!Object.keys(patch).length) return atual;
    const { data } = await supabase.from('cards').update(patch).eq('id', atual.id).select('*').single();
    return data;
  }
  const { data } = await supabase.from('cards').insert({
    unit_id: conversa.unit_id, departamento: DEP, cod_alu: codAlu,
    nome_aluno: conversa.nome_contato || null, telefone: conversa.telefone,
    titulo: String(titulo || 'Atendimento via WhatsApp').slice(0, 200),
    status, prioridade: prioridade || 'normal', canal_origem: 'whatsapp', conversa_id: conversa.id
  }).select('*').single();
  if (data) await supabase.from('card_eventos').insert({
    card_id: data.id, unit_id: conversa.unit_id, departamento: DEP, tipo: 'sistema', descricao: 'Card aberto pelo atendimento no WhatsApp'
  });
  return data;
}

/** Move o card da conversa (se existir) — usado na movimentação automática. */
export async function moverCardConversa(conversa, status) {
  if (simulando()) return;
  const card = await cardDeConversa(conversa);
  if (card && card.status !== status) {
    await supabase.from('cards').update({ status, updated_at: new Date().toISOString() }).eq('id', card.id);
  }
}
