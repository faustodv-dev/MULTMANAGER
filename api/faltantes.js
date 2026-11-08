import { supabase, usuarioDaRequisicao, lerCorpo, registrar } from './_lib/base.js';
import { faltantesDaUnidade, mesclarFaltantes, processarFaltantesUnidade, previaFaltantes, reavaliarFaltantes, FALTANTES_PADRAO } from './_lib/faltantes.js';
import { STATUS_CANONICOS } from './_lib/regua.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const eu = await usuarioDaRequisicao(req);
  if (!eu) return res.status(401).json({ erro: 'nao_autenticado' });

  const b = await lerCorpo(req);
  const acao = String(b.acao || 'obter');
  const unitId = eu.papel === 'master' ? String(b.unit_id || eu.unit_id || '') : eu.unit_id;
  if (!unitId) return res.status(400).json({ erro: 'sem_unidade' });

  const daUnidade = eu.unit_id === unitId;
  const podeVer = eu.papel === 'master' || (daUnidade && (eu.papel === 'admin' || eu.papel === 'coordenador' || (eu.modulos || []).includes('pedagogico')));
  const podeEditar = eu.papel === 'master' || (daUnidade && eu.papel === 'admin');
  if (!podeVer) return res.status(403).json({ erro: 'sem_permissao' });

  try {
    if (acao === 'obter') {
      const regua = await faltantesDaUnidade(unitId);
      const { data: ultimos } = await supabase.from('fila_mensagens')
        .select('categoria,telefone,alunos,status,agendado_para,enviado_em,enfileirado_em,erro')
        .eq('unit_id', unitId).eq('origem', 'regua_faltantes')
        .order('enfileirado_em', { ascending: false }).limit(20);
      return res.status(200).json({ ok: true, regua, padrao: FALTANTES_PADRAO, statuses_disponiveis: STATUS_CANONICOS, ultimos: ultimos || [] });
    }

    if (acao === 'previa') {
      const r = await previaFaltantes(unitId, { dataIso: b.data || null });
      return res.status(200).json({ ok: true, previa: r });
    }

    if (!podeEditar) return res.status(403).json({ erro: 'sem_permissao' });

    if (acao === 'salvar') {
      const regua = mesclarFaltantes(b.regua);
      const { error } = await supabase.from('units').update({ regua_faltantes: regua }).eq('id', unitId);
      if (error) return res.status(400).json({ erro: 'falha_salvar', mensagem: error.message });
      await registrar('faltantes', 'salvar', true, { unitId, detalhe: { por: eu.id, ativa: regua.ativa } });
      return res.status(200).json({ ok: true, regua });
    }

    if (acao === 'rodar_agora') {
      const r = await processarFaltantesUnidade(unitId, { dataIso: b.data || null, forcar: true });
      return res.status(200).json({ ok: true, resumo: r });
    }

    if (acao === 'reavaliar') {
      // Recalcula temperaturas/cards da data (por turma), SEM enfileirar nem enviar.
      const r = await reavaliarFaltantes(unitId, { dataIso: b.data || null });
      return res.status(200).json({ ok: true, resumo: r });
    }

    return res.status(400).json({ erro: 'acao_invalida' });
  } catch (e) {
    return res.status(500).json({ erro: 'interno', mensagem: e.message });
  }
}
