import { supabase, usuarioDaRequisicao, lerCorpo, registrar, digitos } from './_lib/base.js';
import { enfileirar } from './_lib/fila.js';
import { faltantesDaUnidade, mesclarFaltantes, processarFaltantesUnidade, previaFaltantes, reavaliarFaltantes, FALTANTES_PADRAO } from './_lib/faltantes.js';
import { avisoDaUnidade, mesclarAviso, previaAviso, processarAvisoUnidade, AVISO_PADRAO } from './_lib/avisos.js';
import { formandoDaUnidade, mesclarFormando, previaFormando, processarFormandoUnidade, FORMANDO_PADRAO } from './_lib/formando.js';
import { boletimDaUnidade, mesclarBoletim, previaBoletim, processarBoletimUnidade, BOLETIM_PADRAO } from './_lib/boletim.js';
import { panoramaDisparos, mesclarDisparos, configDisparos } from './_lib/disparos.js';
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

    // ===== Régua de AVISOS (lembrete de aula) — passo 1: config + prévia (sem envio) =====
    if (acao === 'aviso_obter') {
      const aviso = await avisoDaUnidade(unitId);
      const { data: ultimos } = await supabase.from('fila_mensagens')
        .select('categoria,telefone,alunos,status,agendado_para,enviado_em,enfileirado_em,erro')
        .eq('unit_id', unitId).eq('origem', 'regua_aviso')
        .order('enfileirado_em', { ascending: false }).limit(25);
      return res.status(200).json({ ok: true, aviso, padrao: AVISO_PADRAO, pode_todos: eu.papel === 'master', ultimos: ultimos || [] });
    }

    if (acao === 'aviso_previa') {
      const r = await previaAviso(unitId, { dataIso: b.data || null });
      return res.status(200).json({ ok: true, previa: r });
    }

    // ===== Régua de FORMANDO (funil 80%→100%) — config + prévia (sem envio) =====
    if (acao === 'formando_obter') {
      const regua = await formandoDaUnidade(unitId);
      const { data: ultimos } = await supabase.from('fila_mensagens')
        .select('categoria,telefone,alunos,status,agendado_para,enviado_em,enfileirado_em,erro')
        .eq('unit_id', unitId).eq('origem', 'regua_formando')
        .order('enfileirado_em', { ascending: false }).limit(25);
      return res.status(200).json({ ok: true, regua, padrao: FORMANDO_PADRAO, ultimos: ultimos || [] });
    }

    if (acao === 'formando_previa') {
      const r = await previaFormando(unitId);
      return res.status(200).json({ ok: true, previa: r });
    }

    // ===== Régua de BOLETIM (mensal, dia 01) — config + prévia (sem envio) =====
    if (acao === 'boletim_obter') {
      const regua = await boletimDaUnidade(unitId);
      const { data: ultimos } = await supabase.from('fila_mensagens')
        .select('categoria,telefone,alunos,status,agendado_para,enviado_em,enfileirado_em,erro')
        .eq('unit_id', unitId).eq('origem', 'regua_boletim')
        .order('enfileirado_em', { ascending: false }).limit(25);
      return res.status(200).json({ ok: true, regua, padrao: BOLETIM_PADRAO, ultimos: ultimos || [] });
    }

    if (acao === 'boletim_previa') {
      const r = await previaBoletim(unitId, b.mes || null);
      return res.status(200).json({ ok: true, previa: r });
    }

    // ===== Central de Disparos (anti-bloqueio): panorama + teto por unidade =====
    if (acao === 'disparos_obter') {
      const [config, panorama] = await Promise.all([configDisparos(unitId), panoramaDisparos(unitId)]);
      return res.status(200).json({ ok: true, config, panorama });
    }

    if (!podeEditar) return res.status(403).json({ erro: 'sem_permissao' });

    if (acao === 'aviso_salvar') {
      const aviso = mesclarAviso(b.aviso);
      // Trava: o alvo "todos" só o master liga, em qualquer unidade (evita estourar cota/gateway).
      if (aviso.alvo === 'todos' && eu.papel !== 'master') {
        return res.status(403).json({ erro: 'todos_apenas_master', mensagem: 'A opção "Todos" só pode ser ligada pelo administrador master.' });
      }
      const { error } = await supabase.from('units').update({ regua_aviso: aviso }).eq('id', unitId);
      if (error) return res.status(400).json({ erro: 'falha_salvar', mensagem: error.message });
      await registrar('avisos', 'salvar', true, { unitId, detalhe: { por: eu.id, ativa: aviso.ativa, alvo: aviso.alvo } });
      return res.status(200).json({ ok: true, aviso });
    }

    if (acao === 'aviso_rodar') {
      // Enfileira de verdade (para teste). forcar ignora o liga/desliga; respeita o alvo.
      const r = await processarAvisoUnidade(unitId, { dataIso: b.data || null, forcar: true });
      return res.status(200).json({ ok: true, resumo: r });
    }

    if (acao === 'formando_salvar') {
      const regua = mesclarFormando(b.regua);
      const { error } = await supabase.from('units').update({ regua_formando: regua }).eq('id', unitId);
      if (error) return res.status(400).json({ erro: 'falha_salvar', mensagem: error.message });
      await registrar('formandos', 'salvar', true, { unitId, detalhe: { por: eu.id, ativa: regua.ativa } });
      return res.status(200).json({ ok: true, regua });
    }

    if (acao === 'formando_rodar') {
      const r = await processarFormandoUnidade(unitId, { forcar: true });
      return res.status(200).json({ ok: true, resumo: r });
    }

    if (acao === 'boletim_salvar') {
      const regua = mesclarBoletim(b.regua);
      const { error } = await supabase.from('units').update({ regua_boletim: regua }).eq('id', unitId);
      if (error) return res.status(400).json({ erro: 'falha_salvar', mensagem: error.message });
      await registrar('boletim', 'salvar', true, { unitId, detalhe: { por: eu.id, ativa: regua.ativa } });
      return res.status(200).json({ ok: true, regua });
    }

    if (acao === 'boletim_rodar') {
      const r = await processarBoletimUnidade(unitId, { mes: b.mes || null, forcar: true });
      return res.status(200).json({ ok: true, resumo: r });
    }

    if (acao === 'disparos_salvar') {
      const config = mesclarDisparos(b.config);
      const { error } = await supabase.from('units').update({ disparos: config }).eq('id', unitId);
      if (error) return res.status(400).json({ erro: 'falha_salvar', mensagem: error.message });
      await registrar('disparos', 'salvar', true, { unitId, detalhe: { por: eu.id, teto: config.teto_novas_dia } });
      return res.status(200).json({ ok: true, config });
    }

    // Disparo por LISTA (palestra/aviso geral): envia a mensagem para uma lista de nome+telefone.
    // Não consulta o sistema escolar — só dispara. Variável do texto: {nome}.
    if (acao === 'aviso_broadcast') {
      const texto = String(b.texto || '').trim();
      const lista = Array.isArray(b.lista) ? b.lista : [];
      if (!texto) return res.status(400).json({ erro: 'texto_obrigatorio' });
      const LIMITE = 300; // teto por disparo (protege o gateway/cota)
      const vistos = new Set();
      const itens = [];
      for (const it of lista) {
        if (itens.length >= LIMITE) break;
        const tel = digitos(String(it?.telefone || ''));
        if (tel.length < 10 || vistos.has(tel)) continue;
        vistos.add(tel);
        const nome = String(it?.nome || '').trim();
        const primeiro = nome ? nome.split(/\s+/)[0] : '';
        itens.push({
          telefone: String(it.telefone),
          texto: texto.replace(/\{nome\}/g, primeiro),
          origem: 'regua_aviso', categoria: 'broadcast', prioridade: 5,
          agendado_para: new Date().toISOString(),
          chave: `bcast|${Date.now()}|${tel}`,
          alunos: primeiro || null
        });
      }
      if (!itens.length) return res.status(400).json({ erro: 'lista_vazia', mensagem: 'Nenhum telefone válido na lista.' });
      const n = await enfileirar(unitId, itens);
      await registrar('avisos', 'broadcast', true, { unitId, detalhe: { por: eu.id, total: itens.length } });
      return res.status(200).json({ ok: true, enfileiradas: n, descartados: lista.length - itens.length });
    }

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
