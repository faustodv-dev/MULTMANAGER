import { CFG, igual, supabase, usuarioDaRequisicao, lerCorpo, registrar, digitos } from './_lib/base.js';
import { enviarWhatsapp } from './_lib/gateway.js';
import { reguaDaUnidade, mesclarRegua, processarReguaUnidade, previaManual, dispararManual, preencherDemo, REGUA_PADRAO, STATUS_CANONICOS } from './_lib/regua.js';
import { mesclarFaltantes, processarFaltantesUnidade } from './_lib/faltantes.js';

export const config = { maxDuration: 60 };

function horaSP() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date())) % 24;
}
function ehDomingoSP() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date()) === 'Sun';
}

/**
 * Disparo automático (Vercel Cron, 1x/dia de manhã): processa cada unidade ativa.
 * O dedup em regua_envios garante que, mesmo se o cron rodar de novo no mesmo dia,
 * nenhuma mensagem é enviada duas vezes (a chave inclui o vencimento do dia).
 */
async function rodarCron(res) {
  const hora = horaSP();
  const domingo = ehDomingoSP();
  const { data: units } = await supabase.from('units').select('id, regua, regua_faltantes');
  const resumo = { hora, processadas: 0, enviados: 0, pulados: 0, erros: 0, faltantes_unidades: 0, faltantes_enfileiradas: 0 };
  for (const u of units || []) {
    // Régua financeira (envio direto — inalterada)
    const regua = mesclarRegua(u.regua);
    if (regua.ativa && !(domingo && regua.pula_domingo)) {
      resumo.processadas++;
      const r = await processarReguaUnidade(u.id);
      resumo.enviados += r.enviados || 0;
      resumo.pulados += r.pulados || 0;
      resumo.erros += r.erros || 0;
    }
    // Régua de faltantes (enfileira na fila; o gateway envia no horário da unidade)
    const falt = mesclarFaltantes(u.regua_faltantes);
    if (falt.ativa && !(domingo && falt.pula_domingo)) {
      resumo.faltantes_unidades++;
      const rf = await processarFaltantesUnidade(u.id);
      resumo.faltantes_enfileiradas += rf.enfileiradas || 0;
    }
  }
  await registrar('regua', 'cron', true, { detalhe: resumo });
  return res.status(200).json({ ok: true, ...resumo });
}

export default async function handler(req, res) {
  const auth = String(req.headers.authorization || '');
  if (CFG.cronSecret && auth && igual(auth.replace(/^Bearer\s+/i, ''), CFG.cronSecret)) {
    return rodarCron(res);
  }

  const eu = await usuarioDaRequisicao(req);
  if (!eu) return res.status(401).json({ erro: 'nao_autenticado' });

  const b = await lerCorpo(req);
  const acao = String(b.acao || 'obter');
  const unitId = eu.papel === 'master' ? String(b.unit_id || eu.unit_id || '') : eu.unit_id;
  if (!unitId) return res.status(400).json({ erro: 'sem_unidade' });

  const daUnidade = eu.unit_id === unitId;
  const podeVer = eu.papel === 'master' || (daUnidade && (eu.papel === 'admin' || eu.papel === 'coordenador' || (eu.modulos || []).includes('financeiro')));
  const podeEditar = eu.papel === 'master' || (daUnidade && eu.papel === 'admin');
  if (!podeVer) return res.status(403).json({ erro: 'sem_permissao' });

  try {
    if (acao === 'obter') {
      const regua = await reguaDaUnidade(unitId);
      const { data: ultimos } = await supabase
        .from('regua_envios')
        .select('offset_dias,vencimento,telefone,alunos,valor_centavos,status,enviado_em')
        .eq('unit_id', unitId).order('enviado_em', { ascending: false }).limit(20);
      return res.status(200).json({ ok: true, regua, padrao: REGUA_PADRAO, statuses_disponiveis: STATUS_CANONICOS, ultimos: ultimos || [] });
    }

    if (!podeEditar) return res.status(403).json({ erro: 'sem_permissao' });

    if (acao === 'salvar') {
      const regua = mesclarRegua(b.regua);
      const { error } = await supabase.from('units').update({ regua }).eq('id', unitId);
      if (error) return res.status(400).json({ erro: 'falha_salvar', mensagem: error.message });
      await registrar('regua', 'salvar', true, { unitId, detalhe: { por: eu.id, ativa: regua.ativa } });
      return res.status(200).json({ ok: true, regua });
    }

    if (acao === 'testar') {
      const telefone = digitos(b.telefone || '');
      if (telefone.length < 10) return res.status(400).json({ erro: 'telefone_invalido', mensagem: 'Informe um número com DDD.' });
      const regua = await reguaDaUnidade(unitId);
      const passo = regua.passos.find((p) => Number(p.offset) === Number(b.offset)) || regua.passos[0];
      const env = await enviarWhatsapp(unitId, telefone, `【TESTE DA RÉGUA】\n${preencherDemo(passo.texto)}`, { conversaId: null });
      if (!env.ok && env.status !== 'simulado') return res.status(200).json({ ok: false, status: env.status, erro: env.erro || 'falha_envio' });
      return res.status(200).json({ ok: true, status: env.status });
    }

    if (acao === 'rodar_agora') {
      const r = await processarReguaUnidade(unitId, { forcar: true });
      return res.status(200).json({ ok: true, resumo: r });
    }

    if (acao === 'previa_manual') {
      const r = await previaManual(unitId, { de: String(b.de || ''), ate: String(b.ate || ''), statuses: Array.isArray(b.statuses) ? b.statuses : [] });
      return res.status(200).json({ ok: true, previa: r });
    }

    if (acao === 'disparar_manual') {
      if (!b.de || !b.ate) return res.status(400).json({ erro: 'periodo_obrigatorio' });
      // trava anti-reenvio: mesmo disparo repetido em menos de 2 min
      const { data: recente } = await supabase.from('regua_jobs')
        .select('id').eq('unit_id', unitId)
        .contains('params', { de: String(b.de), ate: String(b.ate), offset: Number(b.offset) })
        .gte('created_at', new Date(Date.now() - 120000).toISOString()).limit(1);
      if (recente && recente.length) return res.status(429).json({ erro: 'reenvio_rapido', mensagem: 'Esse mesmo disparo foi feito há pouco. Aguarde ~2 minutos.' });

      const { job_id, resumo } = await dispararManual(unitId, {
        de: String(b.de), ate: String(b.ate),
        statuses: Array.isArray(b.statuses) ? b.statuses : [],
        offset: Number(b.offset), criadoPor: eu.id
      });
      return res.status(200).json({ ok: true, job_id, resumo });
    }

    return res.status(400).json({ erro: 'acao_invalida' });
  } catch (e) {
    return res.status(500).json({ erro: 'interno', mensagem: e.message });
  }
}
