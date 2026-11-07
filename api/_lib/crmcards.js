import { supabase } from './base.js';
import { simulando } from './contexto.js';

/**
 * Integração do atendimento por WhatsApp com o Kanban do CRM.
 * Um card representa um atendimento (começo-meio-fim) na tela do departamento certo.
 * O departamento vem da classificação do roteador (conversa.departamento); sem isso,
 * cai em 'financeiro' por compatibilidade. No simulador nada é gravado.
 */

const DEPARTAMENTOS = ['financeiro', 'pedagogico', 'encaminhamento'];
const depValido = (d) => (DEPARTAMENTOS.includes(String(d)) ? String(d) : 'financeiro');

/** Card aberto (não finalizado) ligado a esta conversa; opcionalmente de um departamento. */
export async function cardDeConversa(conversa, departamento = null) {
  let q = supabase.from('cards').select('*')
    .eq('unit_id', conversa.unit_id).eq('conversa_id', conversa.id).neq('status', 'resolvido');
  if (departamento) q = q.eq('departamento', depValido(departamento));
  const { data } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

/** Garante um card aberto para a conversa no departamento indicado; cria se não houver. */
export async function garantirCardWhatsapp(conversa, { departamento, titulo, status = 'andamento', prioridade } = {}) {
  if (simulando()) return null;
  const dep = depValido(departamento || conversa.departamento);
  const codAlu = (conversa.cod_alus || [])[0] || null;
  const atual = await cardDeConversa(conversa, dep);
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
    unit_id: conversa.unit_id, departamento: dep, cod_alu: codAlu,
    nome_aluno: conversa.nome_contato || null, telefone: conversa.telefone,
    titulo: String(titulo || 'Atendimento via WhatsApp').slice(0, 200),
    status, prioridade: prioridade || 'normal', canal_origem: 'whatsapp', conversa_id: conversa.id
  }).select('*').single();
  if (data) await supabase.from('card_eventos').insert({
    card_id: data.id, unit_id: conversa.unit_id, departamento: dep, tipo: 'sistema', descricao: 'Card aberto pelo atendimento no WhatsApp'
  });
  return data;
}

/** Move o card da conversa (o mais recente em aberto) — usado na movimentação automática. */
export async function moverCardConversa(conversa, status) {
  if (simulando()) return;
  const card = await cardDeConversa(conversa);
  if (card && card.status !== status) {
    await supabase.from('cards').update({ status, updated_at: new Date().toISOString() }).eq('id', card.id);
  }
}
