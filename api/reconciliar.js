import { supabase, CFG, igual, registrar, usuarioDaRequisicao } from './_lib/base.js';
import { segredosUnidade } from './_lib/conversa.js';
import { ponte } from './_lib/ponte.js';
import { excluirCobranca } from './_lib/asaas.js';

export const config = { maxDuration: 60 };

/**
 * Rotina diária (Vercel Cron) de reconciliação Asaas × sistema escolar:
 * se uma parcela foi baixada no sistema (pagamento na secretaria) e a cobrança no Asaas
 * ainda está em aberto, cancela a cobrança para o aluno não ser cobrado em dobro.
 */
export default async function handler(req, res) {
  const auth = String(req.headers.authorization || '');
  const porCron = CFG.cronSecret && igual(auth.replace(/^Bearer\s+/i, ''), CFG.cronSecret);
  if (!porCron) {
    const eu = await usuarioDaRequisicao(req);
    if (!eu || eu.papel !== 'master') return res.status(403).json({ erro: 'sem_permissao' });
  }

  const { data: comChave } = await supabase.from('unit_secrets').select('unit_id').not('asaas_api_key', 'is', null);
  const unidades = (comChave || []).map((u) => u.unit_id);
  const resumo = { canceladas: 0, erros: 0, conferidas: 0, unidades: unidades.length };

  for (const unitId of unidades) {
    try {
      const segredos = await segredosUnidade(unitId);
      if (!segredos.asaas) continue;
      const { data: pendentes } = await supabase
        .from('cobrancas_asaas').select('*').eq('unit_id', unitId).eq('status', 'pendente').limit(500);
      if (!pendentes?.length) continue;

      const todasPars = [...new Set(pendentes.flatMap((c) => c.cod_pars))];
      const status = await ponte(unitId, 'parcelas_status', { cod_pars: todasPars }, {});
      const baixada = new Map(status.map((s) => [s.cod_par, s.baixada]));

      for (const c of pendentes) {
        resumo.conferidas++;
        const todasBaixadas = c.cod_pars.every((p) => baixada.get(p));
        if (!todasBaixadas) continue;
        // Parcela(s) já baixada(s) no sistema e cobrança ainda aberta no Asaas → cancelar
        try {
          if (c.asaas_payment_id) await excluirCobranca(segredos.asaas, c.asaas_payment_id, unitId);
          await supabase.from('cobrancas_asaas').update({
            status: 'cancelado', observacao: 'Parcela baixada no sistema escolar (pagamento na secretaria). Cobrança Asaas cancelada.', updated_at: new Date().toISOString()
          }).eq('id', c.id);
          resumo.canceladas++;
        } catch (e) {
          resumo.erros++;
          await supabase.from('cobrancas_asaas').update({ observacao: `Falha ao cancelar no Asaas: ${e.message}` }).eq('id', c.id);
        }
      }
    } catch (e) {
      resumo.erros++;
      await registrar('asaas', 'reconciliar_erro', false, { unitId, detalhe: { erro: e.message } });
    }
  }
  await registrar('asaas', 'reconciliar', true, { detalhe: resumo });
  return res.status(200).json({ ok: true, ...resumo });
}
