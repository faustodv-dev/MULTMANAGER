import { supabase, usuarioDaRequisicao, podeModulo, lerCorpo } from './_lib/base.js';
import { ponte } from './_lib/ponte.js';

export const config = { maxDuration: 60 };

/**
 * Ações da secretaria sobre um comprovante:
 *  - resolver: já foi tratado no sistema escolar (baixa manual)
 *  - rejeitar: comprovante inválido
 *  - baixar: executa a baixa sugerida pela ponte (só quando a unidade não está em modo sombra)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const perfil = await usuarioDaRequisicao(req);
  if (!perfil) return res.status(401).json({ erro: 'nao_autenticado' });

  const { comprovante_id, acao, observacao } = await lerCorpo(req);
  const { data: comp } = await supabase.from('comprovantes').select('*').eq('id', comprovante_id).maybeSingle();
  if (!comp) return res.status(404).json({ erro: 'nao_encontrado' });
  if (!podeModulo(perfil, comp.unit_id, 'comprovantes')) return res.status(403).json({ erro: 'sem_permissao' });

  const obs = String(observacao || '').slice(0, 500);
  const fecharPendencias = () =>
    supabase.from('pendencias').update({ resolvido_em: new Date().toISOString(), resolvido_por: perfil.id })
      .eq('comprovante_id', comp.id).is('resolvido_em', null);

  if (acao === 'resolver' || acao === 'rejeitar') {
    await supabase.from('comprovantes').update({
      status: acao === 'resolver' ? 'resolvido_manual' : 'rejeitado',
      observacao: [comp.observacao, obs && `${perfil.nome || perfil.email}: ${obs}`].filter(Boolean).join(' | '),
      resolvido_por: perfil.id, resolvido_em: new Date().toISOString()
    }).eq('id', comp.id);
    await fecharPendencias();
    return res.status(200).json({ ok: true });
  }

  if (acao === 'baixar') {
    if (!comp.cod_pars?.length || !comp.valor_centavos || !comp.data_pagamento) {
      return res.status(400).json({ erro: 'sem_sugestao', mensagem: 'Este comprovante não tem parcelas identificadas.' });
    }
    if (comp.status === 'baixado') return res.status(409).json({ erro: 'ja_baixado' });
    try {
      const r = await ponte(comp.unit_id, 'baixar', {
        cod_pars: comp.cod_pars, valor_pago: comp.valor_centavos, data_pagamento: comp.data_pagamento,
        chave: `comp-${comp.id}`, origem: 'crm',
        detalhe: `Aprovada por ${perfil.nome || perfil.email} no CRM.`
      }, { timeoutMs: 30000 });
      await supabase.from('comprovantes').update({
        status: 'baixado', ponte_resultado: r, resolvido_por: perfil.id, resolvido_em: new Date().toISOString()
      }).eq('id', comp.id);
      await fecharPendencias();
      return res.status(200).json({ ok: true });
    } catch (e) {
      const msg = e.codigo === 'baixa_desligada' ? 'Unidade em modo sombra: faça a baixa no sistema escolar e marque como resolvido.' : e.message;
      return res.status(422).json({ erro: e.codigo || 'falha', mensagem: msg });
    }
  }
  return res.status(400).json({ erro: 'acao_invalida' });
}
