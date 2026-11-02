import { supabase, CFG, igual, registrar, reais } from './_lib/base.js';
import { obterUnidade, segredosUnidade } from './_lib/conversa.js';
import { ponte } from './_lib/ponte.js';

export const config = { maxDuration: 30 };

const centavos = (v) => Math.round(Number(v || 0) * 100);

async function alerta(unitId, motivo) {
  if (!unitId) return;
  await supabase.from('pendencias').insert({ unit_id: unitId, tipo: 'comprovante', motivo: motivo.slice(0, 500) });
}

/**
 * Webhook do Asaas. Confirma pagamentos (boleto/Pix) gerados pelo CRM:
 * baixa no sistema escolar (modo automático) ou abre alerta para a secretaria (modo sombra).
 * Pagamento que o sistema não conseguir identificar também vira alerta.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });

  const token = req.headers['asaas-access-token'] || '';
  if (!CFG.asaasWebhookToken || !igual(token, CFG.asaasWebhookToken)) {
    return res.status(401).json({ erro: 'nao_autorizado' });
  }

  const evento = req.body?.event || '';
  const pay = req.body?.payment || {};
  // Responde rápido; o Asaas reenvia em caso de erro, então nunca devolvemos 500.
  try {
    const { data: cobranca } = await supabase.from('cobrancas_asaas').select('*').eq('asaas_payment_id', pay.id).maybeSingle();

    if (!cobranca) {
      // Pagamento que não reconhecemos (criado fora do CRM ou já removido)
      const unitId = String(pay.externalReference || '').split('|')[0] || null;
      if (/RECEIVED|CONFIRMED/.test(evento)) {
        await alerta(unitId, `Pagamento Asaas não identificado pelo sistema: ${reais(centavos(pay.value))} (${pay.id}). Conferir manualmente.`);
      }
      return res.status(200).json({ status: 'sem_cobranca' });
    }

    if (/PAYMENT_RECEIVED|PAYMENT_CONFIRMED/.test(evento)) {
      if (['baixado', 'confirmado', 'recebido'].includes(cobranca.status) && cobranca.baixado_no_sistema) {
        return res.status(200).json({ status: 'ja_processado' });
      }
      const recebidoCent = centavos(pay.value);
      const dataPag = (pay.paymentDate || pay.clientPaymentDate || pay.confirmedDate || '').slice(0, 10) || null;
      await supabase.from('cobrancas_asaas').update({
        status: evento.includes('CONFIRMED') ? 'confirmado' : 'recebido', recebido_em: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', cobranca.id);

      const unidade = await obterUnidade(cobranca.unit_id);
      if (unidade?.baixa_automatica) {
        try {
          const r = await ponte(cobranca.unit_id, 'baixar', {
            cod_pars: cobranca.cod_pars, valor_pago: recebidoCent, data_pagamento: dataPag,
            chave: `asaas-${pay.id}`, origem: 'asaas', confiar_valor: true,
            detalhe: `Pagamento confirmado no Asaas (${pay.billingType || ''} ${pay.id}).`
          }, { timeoutMs: 30000 });
          await supabase.from('cobrancas_asaas').update({ status: 'baixado', baixado_no_sistema: true, observacao: 'Baixa automática pelo Asaas.' }).eq('id', cobranca.id);
          await registrar('asaas', 'baixa_automatica', true, { unitId: cobranca.unit_id, detalhe: { pay: pay.id } });
        } catch (e) {
          await supabase.from('cobrancas_asaas').update({ observacao: `Falha ao baixar: ${e.message}` }).eq('id', cobranca.id);
          await alerta(cobranca.unit_id, `Pagamento Asaas recebido de ${cobranca.nome_aluno} (${reais(recebidoCent)}), mas a baixa automática falhou: ${e.message}. Baixar manualmente (parcelas ${cobranca.cod_pars.join('/')}).`);
        }
      } else {
        await alerta(cobranca.unit_id, `Pagamento Asaas recebido de ${cobranca.nome_aluno} — ${reais(recebidoCent)}, parcela(s) ${cobranca.cod_pars.join('/')}. Dar baixa no sistema escolar.`);
      }
      return res.status(200).json({ status: 'processado' });
    }

    if (/PAYMENT_DELETED|PAYMENT_REFUNDED/.test(evento)) {
      await supabase.from('cobrancas_asaas').update({ status: evento.includes('REFUNDED') ? 'estornado' : 'cancelado', updated_at: new Date().toISOString() }).eq('id', cobranca.id);
    } else if (/PAYMENT_OVERDUE/.test(evento) && cobranca.status === 'pendente') {
      // mantém pendente; a régua e a reconciliação cuidam do resto
    }
    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    await registrar('asaas', 'webhook_erro', false, { detalhe: { erro: e.message, evento } });
    return res.status(200).json({ status: 'erro', erro: e.message });
  }
}
