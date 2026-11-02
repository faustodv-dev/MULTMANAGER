import crypto from 'crypto';
import { supabase, CFG, usuarioDaRequisicao, lerCorpo } from './_lib/base.js';
import { processarEntrada } from './_lib/entrada.js';
import { contexto } from './_lib/contexto.js';

export const config = { maxDuration: 60 };

/**
 * Simulador da assistente (master e admins): conversa como se fosse o aluno, com os
 * dados reais do sistema escolar, mas sem enviar WhatsApp e sem gravar no sistema.
 * Corpo: { unit_id, telefone, texto?, arquivo?: { base64, nome, mime }, reiniciar? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const eu = await usuarioDaRequisicao(req);
  if (!eu || !['master', 'admin'].includes(eu.papel)) return res.status(403).json({ erro: 'sem_permissao' });

  const b = await lerCorpo(req);
  const unitId = eu.papel === 'master' ? String(b.unit_id || '') : eu.unit_id;
  const telefone = String(b.telefone || '').replace(/\D/g, '');
  const fone = telefone.startsWith('55') ? telefone : `55${telefone}`;
  if (!unitId || fone.length < 12) return res.status(400).json({ erro: 'parametros', mensagem: 'Informe a unidade e um telefone com DDD.' });

  const buscarConversa = async () =>
    (await supabase.from('conversas').select('*').eq('unit_id', unitId).eq('telefone', fone).eq('canal', 'simulador').maybeSingle()).data;

  if (b.reiniciar) {
    const c = await buscarConversa();
    if (c) {
      await supabase.from('pendencias').delete().eq('conversa_id', c.id);
      await supabase.from('comprovantes').delete().eq('conversa_id', c.id).eq('simulacao', true);
      await supabase.from('conversas').delete().eq('id', c.id);
    }
    return res.status(200).json({ ok: true, reiniciada: true });
  }

  const payload = { unitId, phone: fone, senderName: 'Simulador', messageId: `sim-${crypto.randomUUID()}`, message: String(b.texto || '').slice(0, 4000) };

  if (b.arquivo?.base64) {
    const buf = Buffer.from(String(b.arquivo.base64), 'base64');
    if (buf.length > 3 * 1024 * 1024) return res.status(413).json({ erro: 'arquivo_grande', mensagem: 'Máximo 3 MB no simulador.' });
    const mime = String(b.arquivo.mime || 'image/jpeg');
    const nome = String(b.arquivo.nome || 'arquivo').normalize('NFD').replace(/[^\w.\-]+/g, '_').slice(-80);
    const caminho = `${unitId}/simulador/${Date.now()}_${nome}`;
    const { error } = await supabase.storage.from(CFG.bucket).upload(caminho, buf, { contentType: mime });
    if (error) return res.status(500).json({ erro: 'upload', mensagem: error.message });
    Object.assign(payload, {
      mediaKind: mime.startsWith('image/') ? 'image' : 'document',
      mediaPath: caminho, mediaMimeType: mime, mediaFileName: nome
    });
  }
  if (!payload.message && !payload.mediaPath) return res.status(400).json({ erro: 'vazio' });

  const status = await contexto.run({ simulacao: true }, () => processarEntrada(payload, { canal: 'simulador' }));
  const c = await buscarConversa();
  return res.status(200).json({ ok: true, status, conversa_id: c?.id || null });
}
