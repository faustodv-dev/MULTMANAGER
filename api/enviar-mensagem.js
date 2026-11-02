import { supabase, usuarioDaRequisicao, podeModulo, lerCorpo } from './_lib/base.js';
import { enviarWhatsapp } from './_lib/gateway.js';
import { salvarMensagem } from './_lib/conversa.js';

export const config = { maxDuration: 60 };

/** A secretaria responde pelo CRM; a conversa passa para atendimento humano. */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const perfil = await usuarioDaRequisicao(req);
  if (!perfil) return res.status(401).json({ erro: 'nao_autenticado' });

  const { conversa_id, texto } = await lerCorpo(req);
  const msg = String(texto || '').trim();
  if (!conversa_id || !msg || msg.length > 4000) return res.status(400).json({ erro: 'parametros' });

  const { data: conversa } = await supabase.from('conversas').select('*').eq('id', conversa_id).maybeSingle();
  if (!conversa) return res.status(404).json({ erro: 'conversa_nao_encontrada' });
  if (!podeModulo(perfil, conversa.unit_id, 'atendimento')) return res.status(403).json({ erro: 'sem_permissao' });

  const env = await enviarWhatsapp(conversa.unit_id, conversa.telefone, msg, { remoteJid: conversa.remote_jid, conversaId: conversa.id });
  await salvarMensagem(conversa, {
    direcao: 'out', autor: 'humano', texto: msg, enviado_por: perfil.id,
    wa_message_id: env.msgId || null, status_envio: env.ok ? env.status : `erro: ${env.erro || ''}`.slice(0, 200)
  });
  await supabase.from('conversas').update({ status: 'humano', atribuido_a: conversa.atribuido_a || perfil.id, nao_lidas: 0 }).eq('id', conversa.id);
  if (!env.ok) return res.status(502).json({ erro: 'falha_envio', detalhe: env.erro });
  return res.status(200).json({ ok: true });
}
