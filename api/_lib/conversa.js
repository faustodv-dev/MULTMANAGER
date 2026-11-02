import { supabase, CFG } from './base.js';
import { enviarWhatsapp } from './gateway.js';
import { simulando } from './contexto.js';

export async function obterUnidade(unitId) {
  const { data } = await supabase.from('units').select('*').eq('id', unitId).maybeSingle();
  return data;
}

export async function segredosUnidade(unitId) {
  const { data } = await supabase.from('unit_secrets').select('*').eq('unit_id', unitId).maybeSingle();
  return {
    asaas: data?.asaas_api_key || '',
    gemini: data?.gemini_api_key || CFG.geminiKey,
    groq: data?.groq_api_key || CFG.groqKey
  };
}

export async function obterOuCriarConversa(unitId, telefone, { remoteJid, nome, canal = 'whatsapp' }) {
  const { data: existente } = await supabase.from('conversas').select('*').eq('unit_id', unitId).eq('telefone', telefone).eq('canal', canal).maybeSingle();
  if (existente) {
    const patch = {};
    if (remoteJid && remoteJid !== existente.remote_jid) patch.remote_jid = remoteJid;
    if (nome && !existente.nome_contato) patch.nome_contato = nome;
    if (Object.keys(patch).length) await supabase.from('conversas').update(patch).eq('id', existente.id);
    return { ...existente, ...patch };
  }
  const { data, error } = await supabase
    .from('conversas')
    .upsert({ unit_id: unitId, telefone, canal, remote_jid: remoteJid || null, nome_contato: nome || null }, { onConflict: 'unit_id,telefone,canal' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Grava a mensagem; retorna null se já existia (mesmo id do WhatsApp). */
export async function salvarMensagem(conversa, campos) {
  const linha = { conversa_id: conversa.id, unit_id: conversa.unit_id, ...campos };
  const { data, error } = await supabase.from('mensagens').insert(linha).select('*').single();
  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  const resumo = campos.texto || (campos.midia_nome ? `📎 ${campos.midia_nome}` : '');
  const patch = { ultima_mensagem: resumo.slice(0, 200), ultimo_contato: new Date().toISOString() };
  if (campos.direcao === 'in') {
    const { data: c } = await supabase.from('conversas').select('nao_lidas').eq('id', conversa.id).single();
    patch.nao_lidas = (c?.nao_lidas || 0) + 1;
  }
  await supabase.from('conversas').update(patch).eq('id', conversa.id);
  return data;
}

export async function atualizarConversa(id, patch) {
  const { data } = await supabase.from('conversas').update(patch).eq('id', id).select('*').single();
  return data;
}

/** Responde ao contato pelo WhatsApp e registra a mensagem como da IA. */
export async function responder(conversa, texto, { documento = null, midia = null } = {}) {
  const env = await enviarWhatsapp(conversa.unit_id, conversa.telefone, texto, {
    remoteJid: conversa.remote_jid, documento, conversaId: conversa.id
  });
  await salvarMensagem(conversa, {
    direcao: 'out', autor: 'ia', texto,
    midia_path: midia?.path || null, midia_tipo: midia?.tipo || null, midia_nome: midia?.nome || null,
    wa_message_id: env.msgId || null, status_envio: env.ok ? env.status : `erro: ${env.erro || ''}`.slice(0, 200)
  });
  return env;
}

/** Passa a conversa para a fila humana (a IA para de responder). */
export async function chamarHumano(conversa, motivo, { comprovanteId = null, tipo = 'atendimento' } = {}) {
  await supabase.from('conversas').update({ status: 'aguardando_humano', motivo_humano: motivo.slice(0, 300) }).eq('id', conversa.id);
  await supabase.from('pendencias').insert({
    unit_id: conversa.unit_id, conversa_id: conversa.id, comprovante_id: comprovanteId, tipo, motivo: motivo.slice(0, 500),
    simulacao: simulando()
  });
}

export async function historico(conversaId, limite = 20) {
  const { data } = await supabase
    .from('mensagens')
    .select('direcao, autor, texto, midia_nome, criado_em')
    .eq('conversa_id', conversaId)
    .order('criado_em', { ascending: false })
    .limit(limite);
  return (data || []).reverse();
}
