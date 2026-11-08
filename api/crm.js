import { supabase, CFG, usuarioDaRequisicao, podeModulo, lerCorpo, hojeSP, digitos, reais, dataBr } from './_lib/base.js';
import { ponte } from './_lib/ponte.js';

export const config = { maxDuration: 30 };

const DEPARTAMENTOS = ['financeiro', 'pedagogico', 'encaminhamento'];

/* ───────── datas / períodos ───────── */
const emSP = () => new Date(`${hojeSP()}T12:00:00-03:00`);
function somaDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
const iso = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
function semanaISO(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ano = t.getUTCFullYear();
  const sem = Math.ceil(((t - new Date(Date.UTC(ano, 0, 1))) / 86400000 + 1) / 7);
  return { ano, sem, segunda: somaDias(d, -(dia - 1)), domingo: somaDias(d, 7 - dia) };
}
function refsAtuais() {
  const hoje = emSP();
  const w = semanaISO(hoje);
  return { dia: iso(hoje), semana: `${w.ano}-W${String(w.sem).padStart(2, '0')}`, mes: iso(hoje).slice(0, 7) };
}
function periodoDoPop(pop, hoje) {
  const mes = iso(hoje).slice(0, 7);
  if (pop.frequencia === 'diaria') return { ref: iso(hoje), data: iso(hoje), prazo: iso(hoje) };
  if (pop.frequencia === 'semanal') {
    const w = semanaISO(hoje);
    return { ref: `${w.ano}-W${String(w.sem).padStart(2, '0')}`, data: iso(w.segunda), prazo: iso(w.domingo) };
  }
  if (pop.frequencia === 'dia_fixo') {
    const dia = Math.min(Math.max(pop.dia_do_mes || 1, 1), 28);
    const d = new Date(hoje); d.setDate(dia);
    return { ref: mes, data: iso(d), prazo: iso(d) };
  }
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { ref: mes, data: `${mes}-01`, prazo: iso(ultimo) };
}

/** Gera as execuções do período que ainda não existem (1 leitura + 1 inserção em lote, no máximo). */
async function gerarExecucoes(unitId, departamento) {
  const { data: pops } = await supabase.from('pops').select('*').eq('unit_id', unitId).eq('departamento', departamento).eq('ativo', true);
  if (!pops?.length) return;
  const hoje = emSP();
  const alvo = pops.map((pop) => ({ pop, p: periodoDoPop(pop, hoje) }));
  const refs = [...new Set(alvo.map((a) => a.p.ref))];
  const { data: existentes } = await supabase.from('pop_execucoes').select('pop_id, periodo_ref')
    .eq('unit_id', unitId).eq('departamento', departamento).in('periodo_ref', refs);
  const tem = new Set((existentes || []).map((e) => `${e.pop_id}|${e.periodo_ref}`));
  const novos = alvo.filter((a) => !tem.has(`${a.pop.id}|${a.p.ref}`)).map(({ pop, p }) => ({
    unit_id: unitId, pop_id: pop.id, departamento, titulo: pop.titulo, procedimento: pop.procedimento,
    frequencia: pop.frequencia, periodo_ref: p.ref, data_prevista: p.data, prazo: p.prazo, responsavel_id: null
  }));
  if (novos.length) await supabase.from('pop_execucoes').insert(novos);
}

async function execucoesDoPeriodo(unitId, departamento) {
  const r = refsAtuais();
  const { data } = await supabase.from('pop_execucoes').select('*')
    .eq('unit_id', unitId).eq('departamento', departamento).in('periodo_ref', [r.dia, r.semana, r.mes])
    .order('data_prevista', { ascending: true });
  return data || [];
}

async function listarColaboradores(unitId) {
  const { data } = await supabase.from('profiles').select('id, nome, email, papel')
    .eq('ativo', true).or(`unit_id.eq.${unitId},papel.eq.master`).order('nome');
  return data || [];
}

function resumoDe(cards, execs) {
  const hoje = hojeSP(), mes = hoje.slice(0, 7);
  const abertos = cards.filter((c) => c.status !== 'resolvido');
  const popsHoje = execs.filter((e) => e.frequencia === 'diaria');
  return {
    atendimentos_abertos: abertos.length,
    atendimentos_alta: abertos.filter((c) => c.prioridade === 'alta').length,
    atendimentos_resolvidos_mes: cards.filter((c) => c.status === 'resolvido' && (c.resolvido_em || '').slice(0, 7) === mes).length,
    atendimentos_total: cards.length,
    pops_feitos: execs.filter((e) => e.status === 'feito').length, pops_total: execs.length,
    pops_pct: execs.length ? Math.round((execs.filter((e) => e.status === 'feito').length / execs.length) * 100) : 0,
    pops_atrasados: execs.filter((e) => e.status !== 'feito' && e.prazo && e.prazo < hoje).length,
    pops_hoje_feitos: popsHoje.filter((e) => e.status === 'feito').length, pops_hoje_total: popsHoje.length
  };
}

/** Grava um Informativo no sistema escolar (só quando há aluno vinculado). */
async function informativo(unitId, codAlu, texto) {
  if (!codAlu) return;
  await ponte(unitId, 'registrar_ocorrencia', {
    cod_alu: String(codAlu), texto: `[CRM] ${texto}`.slice(0, 1000),
    chave: `crm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }).catch(() => null);
}

const unidadeDe = (perfil, corpo) => (perfil.papel === 'master' ? String(corpo.unidade || perfil.unit_id || 'rio_verde') : perfil.unit_id);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const eu = await usuarioDaRequisicao(req);
  if (!eu) return res.status(401).json({ erro: 'nao_autenticado' });

  const b = await lerCorpo(req);
  const acao = String(b.acao || '');
  const unitId = unidadeDe(eu, b);

  // Dashboard (tela inicial): agrega só dados do CRM (Supabase), nos módulos que o usuário tem.
  if (acao === 'dashboard') {
    try { return await dashboard(res, eu, unitId, b); }
    catch (e) { return res.status(500).json({ erro: 'erro', mensagem: e.message }); }
  }

  // Agência de Emprego: empresas parceiras + vagas (por unidade). Acesso: encaminhamento/admin/master.
  if (acao.startsWith('agencia_')) {
    const podeAg = eu.papel === 'master' || eu.papel === 'admin' || (eu.modulos || []).includes('encaminhamento');
    if (!podeAg) return res.status(403).json({ erro: 'sem_permissao' });
    try { return await agencia(res, acao, unitId, b); }
    catch (e) { return res.status(500).json({ erro: 'erro', mensagem: e.message }); }
  }

  const dep = String(b.departamento || 'financeiro');
  if (!DEPARTAMENTOS.includes(dep)) return res.status(400).json({ erro: 'departamento_invalido' });
  if (!podeModulo(eu, unitId, dep)) return res.status(403).json({ erro: 'sem_permissao' });

  const cardDeB = async () => (await supabase.from('cards').select('*').eq('id', b.card_id).eq('unit_id', unitId).maybeSingle()).data;

  try {
    /* ───────── Carga única da tela ───────── */
    if (acao === 'crm_inicial') {
      await gerarExecucoes(unitId, dep);
      const [cardsR, colabs, execs] = await Promise.all([
        supabase.from('cards').select('*').eq('unit_id', unitId).eq('departamento', dep).neq('status', 'resolvido')
          .order('prioridade', { ascending: true }).order('updated_at', { ascending: false }),
        listarColaboradores(unitId),
        execucoesDoPeriodo(unitId, dep)
      ]);
      const cards = cardsR.data || [];
      return res.status(200).json({ ok: true, cards, colaboradores: colabs, execucoes: execs, resumo: resumoDe(cards, execs) });
    }

    /* ───────── Cards ───────── */
    if (acao === 'cards_listar') {
      const { data } = await supabase.from('cards').select('*').eq('unit_id', unitId).eq('departamento', dep)
        .neq('status', 'resolvido').order('prioridade', { ascending: true }).order('updated_at', { ascending: false });
      return res.status(200).json({ ok: true, cards: data || [] });
    }

    if (acao === 'card_criar') {
      const cod = b.cod_alu ? String(b.cod_alu) : null;
      const linha = {
        unit_id: unitId, departamento: dep, cod_alu: cod,
        nome_aluno: b.nome_aluno || null, nome_responsavel: b.nome_responsavel || null, telefone: b.telefone || null,
        titulo: String(b.titulo || 'Atendimento').slice(0, 200), descricao: b.descricao || null,
        status: 'novo', prioridade: b.prioridade || 'normal',
        responsavel_id: b.responsavel_id || null, prazo: b.prazo || null,
        canal_origem: b.canal_origem || 'presencial', criado_por: eu.id
      };
      const { data, error } = await supabase.from('cards').insert(linha).select('*').single();
      if (error) return res.status(400).json({ erro: 'falha_criar', mensagem: error.message });
      await evento(data.id, unitId, dep, 'sistema', 'Card criado', eu);
      return res.status(200).json({ ok: true, card: data });
    }

    if (acao === 'card_mover') {
      const status = String(b.status || 'novo');
      const patch = { status, resolvido_em: status === 'resolvido' ? new Date().toISOString() : null };
      const { data } = await supabase.from('cards').update(patch).eq('id', b.card_id).eq('unit_id', unitId).select('*').single();
      await evento(b.card_id, unitId, dep, 'status', `Status: ${rotuloStatus(status)}`, eu);
      if (status === 'resolvido' && data?.cod_alu) await informativo(unitId, data.cod_alu, `Atendimento finalizado — ${data.titulo}.`);
      return res.status(200).json({ ok: true, card: data });
    }

    if (acao === 'card_atualizar') {
      const patch = {};
      for (const k of ['titulo', 'descricao', 'prioridade', 'responsavel_id', 'prazo']) if (k in b) patch[k] = b[k] || null;
      const { data } = await supabase.from('cards').update(patch).eq('id', b.card_id).eq('unit_id', unitId).select('*').single();
      return res.status(200).json({ ok: true, card: data });
    }

    if (acao === 'card_evento') {
      const texto = String(b.descricao || '').slice(0, 1000);
      await evento(b.card_id, unitId, dep, b.tipo || 'nota', texto, eu);
      if (b.no_sistema) {
        const card = await cardDeB();
        if (card?.cod_alu) await informativo(unitId, card.cod_alu, `${texto} (por ${eu.nome || 'equipe'})`);
      }
      return res.status(200).json({ ok: true });
    }

    if (acao === 'card_dossie') {
      const { data: card } = await supabase.from('cards').select('*').eq('id', b.card_id).eq('unit_id', unitId).maybeSingle();
      if (!card) return res.status(404).json({ erro: 'card_nao_encontrado' });
      const { data: eventos } = await supabase.from('card_eventos').select('*').eq('card_id', card.id).order('criado_em', { ascending: false }).limit(200);
      const { data: boletos } = await supabase.from('cobrancas_asaas').select('*').eq('unit_id', unitId).eq('cod_alu', card.cod_alu || '___').order('created_at', { ascending: false }).limit(20);
      let historico = [];
      if (card.cod_alu) {
        const { data: hist } = await supabase.from('cards').select('id, departamento, titulo, status, prioridade, created_at, resolvido_em')
          .eq('unit_id', unitId).eq('cod_alu', card.cod_alu).neq('id', card.id).order('created_at', { ascending: false }).limit(50);
        historico = hist || [];
      }
      let mensagens = [];
      if (card.conversa_id) {
        const { data: msgs } = await supabase.from('mensagens').select('id, direcao, autor, texto, midia_nome, criado_em')
          .eq('conversa_id', card.conversa_id).order('criado_em', { ascending: true }).limit(100);
        mensagens = msgs || [];
      }
      return res.status(200).json({ ok: true, card, eventos: eventos || [], boletos: boletos || [], historico, mensagens });
    }

    /* ───────── Situação no sistema escolar (sob demanda — botão) ───────── */
    if (acao === 'aluno_financeiro') {
      const cod = String(b.cod_alu || '');
      if (!cod) return res.status(400).json({ erro: 'sem_aluno' });
      const hoje = hojeSP();
      const r = await ponte(unitId, 'parcelas', { cod_alus: [cod], data_referencia: hoje });
      const parcelas = (r.documentos || []).map((d) => ({
        vencimento: dataBr(d.vencimento), vencida: d.vencimento < hoje,
        valor_hoje: reais(d.valor_devido), valor_em_dia: reais(d.valor_em_dia)
      }));
      return res.status(200).json({ ok: true, parcelas });
    }

    if (acao === 'buscar_aluno') {
      const cpf = digitos(b.cpf), fone = digitos(b.telefone);
      let grupos = [];
      if (cpf.length === 11) grupos = await ponte(unitId, 'buscar_cpf', { cpf });
      else if (fone.length >= 10) grupos = await ponte(unitId, 'buscar_telefone', { telefone: fone });
      else return res.status(400).json({ erro: 'parametros', mensagem: 'Informe CPF (11 díg.) ou telefone com DDD.' });
      const out = (grupos || []).map((g) => ({
        nome_responsavel: g.nome_responsavel, cpf_responsavel: g.cpf_responsavel,
        alunos: (g.alunos || []).map((a) => ({ cod_alu: a.cod_alu, nome: a.nome, ativo: a.ativo, telefone: g.telefone || null }))
      }));
      return res.status(200).json({ ok: true, grupos: out });
    }

    /* ───────── Agenda / POPs ───────── */
    if (acao === 'agenda') {
      await gerarExecucoes(unitId, dep);
      return res.status(200).json({ ok: true, execucoes: await execucoesDoPeriodo(unitId, dep) });
    }

    if (acao === 'exec_atualizar') {
      const patch = {};
      for (const k of ['status', 'observacao', 'evidencia_url', 'responsavel_id', 'data_prevista', 'hora_prevista', 'prazo']) if (k in b) patch[k] = b[k] || null;
      if (patch.status === 'feito') { patch.concluido_em = new Date().toISOString(); patch.concluido_por = eu.id; }
      if (patch.status && patch.status !== 'feito') { patch.concluido_em = null; patch.concluido_por = null; }
      const { data } = await supabase.from('pop_execucoes').update(patch).eq('id', b.exec_id).eq('unit_id', unitId).select('*').single();
      return res.status(200).json({ ok: true, execucao: data });
    }

    if (acao === 'pops_listar') {
      const { data } = await supabase.from('pops').select('*').eq('unit_id', unitId).eq('departamento', dep).eq('ativo', true).order('ordem');
      return res.status(200).json({ ok: true, pops: data || [] });
    }

    /* ───────── Admin: catálogo de POPs ───────── */
    const adminPop = eu.papel === 'master' || (eu.papel === 'admin' && eu.unit_id === unitId);
    if (acao === 'pops_admin') {
      if (!adminPop) return res.status(403).json({ erro: 'sem_permissao' });
      const { data } = await supabase.from('pops').select('*').eq('unit_id', unitId).eq('departamento', dep).order('ordem');
      return res.status(200).json({ ok: true, pops: data || [] });
    }
    if (acao === 'pop_salvar') {
      if (!adminPop) return res.status(403).json({ erro: 'sem_permissao' });
      const campos = {
        departamento: dep,
        titulo: String(b.titulo || '').slice(0, 200), procedimento: b.procedimento || null,
        frequencia: b.frequencia || 'mensal', dia_do_mes: b.dia_do_mes || null,
        responsavel_sugerido: b.responsavel_sugerido || null, ordem: Number(b.ordem) || 0,
        ativo: b.ativo === false ? false : true
      };
      if (!campos.titulo) return res.status(400).json({ erro: 'titulo_obrigatorio' });
      if (b.id) {
        const { data } = await supabase.from('pops').update(campos).eq('id', b.id).eq('unit_id', unitId).select('*').single();
        return res.status(200).json({ ok: true, pop: data });
      }
      const { data } = await supabase.from('pops').insert({ unit_id: unitId, departamento: dep, ...campos }).select('*').single();
      return res.status(200).json({ ok: true, pop: data });
    }
    if (acao === 'pop_excluir') {
      if (!adminPop) return res.status(403).json({ erro: 'sem_permissao' });
      await supabase.from('pops').update({ ativo: false }).eq('id', b.id).eq('unit_id', unitId);
      return res.status(200).json({ ok: true });
    }

    if (acao === 'colaboradores') {
      return res.status(200).json({ ok: true, colaboradores: await listarColaboradores(unitId) });
    }

    /* ───────── Chaves por unidade (admin) — nunca devolve os valores ───────── */
    const adminUnidade = eu.papel === 'master' || (eu.papel === 'admin' && eu.unit_id === unitId);
    if (acao === 'segredos_status') {
      if (!adminUnidade) return res.status(403).json({ erro: 'sem_permissao' });
      const { data } = await supabase.from('unit_secrets').select('asaas_api_key, gemini_api_key, groq_api_key').eq('unit_id', unitId).maybeSingle();
      return res.status(200).json({ ok: true, status: { asaas: !!data?.asaas_api_key, gemini: !!data?.gemini_api_key, groq: !!data?.groq_api_key } });
    }
    if (acao === 'segredos_salvar') {
      if (!adminUnidade) return res.status(403).json({ erro: 'sem_permissao' });
      const limpa = (v) => String(v || '').replace(/[\r\n\s]+/g, '');
      const patch = { unit_id: unitId, updated_at: new Date().toISOString() };
      for (const [campo, col] of [['asaas', 'asaas_api_key'], ['gemini', 'gemini_api_key'], ['groq', 'groq_api_key']]) {
        if (typeof b[campo] === 'string' && limpa(b[campo])) patch[col] = limpa(b[campo]);
      }
      // Copia a chave Asaas de outra unidade (server-side, sem expor o valor). Ex.: Aparecida usa a da Rio Verde.
      if (b.copiar_asaas_de) {
        const { data: fonte } = await supabase.from('unit_secrets').select('asaas_api_key').eq('unit_id', String(b.copiar_asaas_de)).maybeSingle();
        if (fonte?.asaas_api_key) patch.asaas_api_key = fonte.asaas_api_key;
        else return res.status(200).json({ ok: false, erro: 'fonte_sem_asaas', mensagem: 'A unidade de origem não tem chave Asaas.' });
      }
      if (Object.keys(patch).length <= 2) return res.status(400).json({ erro: 'nada_para_salvar' });
      const { error } = await supabase.from('unit_secrets').upsert(patch, { onConflict: 'unit_id' });
      if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
      return res.status(200).json({ ok: true });
    }

    /* ───────── WhatsApp (gateway) — status público e QR via proxy (não expõe chave) ───────── */
    if (acao === 'whatsapp_status') {
      if (!adminUnidade) return res.status(403).json({ erro: 'sem_permissao' });
      if (!CFG.gatewayUrl) return res.status(200).json({ ok: true, status: 'sem_gateway' });
      try {
        const r = await fetch(`${CFG.gatewayUrl}/connect/${encodeURIComponent(unitId)}/status`, { signal: AbortSignal.timeout(8000) });
        const j = await r.json().catch(() => ({}));
        return res.status(200).json({ ok: true, status: j.status || 'desconhecido', phone: j.phone || null });
      } catch (e) {
        return res.status(200).json({ ok: true, status: 'indisponivel' });
      }
    }
    if (acao === 'whatsapp_qr') {
      if (!adminUnidade) return res.status(403).json({ erro: 'sem_permissao' });
      if (!CFG.gatewayUrl) return res.status(400).json({ erro: 'sem_gateway', mensagem: 'Gateway não configurado.' });
      try {
        const r = await fetch(`${CFG.gatewayUrl}/connect/${encodeURIComponent(unitId)}`, {
          headers: { apikey: CFG.gatewayKey || '' }, signal: AbortSignal.timeout(15000)
        });
        const html = await r.text();
        // QR tem prioridade: se há imagem data:, ainda NÃO está conectado (a página do QR também diz "Aparelhos Conectados").
        const m = html.match(/src="(data:image[^"]+)"/);
        if (m) return res.status(200).json({ ok: true, status: 'qr_ready', qr: m[1] });
        if (/Aparelho ativo/i.test(html)) {
          const tel = (html.match(/Aparelho ativo:\s*<strong>([^<]+)</) || [])[1] || null;
          return res.status(200).json({ ok: true, status: 'connected', phone: tel });
        }
        return res.status(200).json({ ok: true, status: 'preparando', qr: null });
      } catch (e) {
        return res.status(502).json({ erro: 'gateway_indisponivel', mensagem: e.message });
      }
    }

    /* ───────── Unidades (master) ───────── */
    if (acao === 'unidades_comercial') {
      if (eu.papel !== 'master') return res.status(403).json({ erro: 'sem_permissao' });
      return res.status(200).json({ ok: true, unidades: [
        { name: 'Água Boa', slug: 'agua_boa' },
        { name: 'Anápolis', slug: 'anapolis' },
        { name: 'Aparecida de Goiânia', slug: 'aparecida' },
        { name: 'Bom Jesus', slug: 'bom_jesus' },
        { name: 'Rio Verde', slug: 'rio_verde' }
      ] });
    }
    if (acao === 'unidade_criar') {
      if (eu.papel !== 'master') return res.status(403).json({ erro: 'sem_permissao' });
      const novoId = String(b.id || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const nome = String(b.name || '').trim();
      if (!novoId || !nome) return res.status(400).json({ erro: 'parametros', mensagem: 'Informe código e nome.' });
      const { data: existe } = await supabase.from('units').select('id').eq('id', novoId).maybeSingle();
      if (existe) return res.status(200).json({ ok: false, erro: 'ja_existe', mensagem: 'Já existe uma unidade com esse código.' });
      const { error } = await supabase.from('units').insert({ id: novoId, name: nome });
      if (error) return res.status(400).json({ erro: 'falha_criar', mensagem: error.message });
      await supabase.from('unit_secrets').insert({ unit_id: novoId }).then(() => {}, () => {});
      // Clona o catálogo de POPs de uma unidade modelo (padrão: rio_verde) → "um novo CRM igual".
      const tpl = String(b.template || 'rio_verde');
      const { data: pops } = await supabase.from('pops')
        .select('departamento, titulo, procedimento, frequencia, dia_do_mes, responsavel_sugerido, ordem')
        .eq('unit_id', tpl).eq('ativo', true);
      if (pops?.length) await supabase.from('pops').insert(pops.map((p) => ({ ...p, unit_id: novoId })));
      return res.status(200).json({ ok: true, id: novoId, pops_clonados: pops?.length || 0 });
    }

    if (acao === 'produtividade') {
      const [cardsR, execs] = await Promise.all([
        supabase.from('cards').select('status, prioridade, resolvido_em').eq('unit_id', unitId).eq('departamento', dep),
        execucoesDoPeriodo(unitId, dep)
      ]);
      return res.status(200).json({ ok: true, resumo: resumoDe(cardsR.data || [], execs) });
    }

    return res.status(400).json({ erro: 'acao_invalida' });
  } catch (e) {
    return res.status(500).json({ erro: e.codigo || 'erro', mensagem: e.message, detalhes: e.detalhes });
  }
}

/**
 * Dashboard da tela inicial. Só dados do CRM (Supabase) — nunca importa do banco escolar.
 * Escopo pelos módulos que o usuário tem (cada um vê do seu nível). Pedagógico em 1º lugar.
 * Filtro por período (de/ate, ISO). Pensado para carga única e leve.
 */
async function dashboard(res, eu, unitId, b) {
  // Painel da unidade: visível a TODOS da unidade (gera responsabilidade de equipe).
  // Não filtra por módulo do usuário — mostra o quadro inteiro (pedagógico + financeiro + encaminhamento).
  const deps = DEPARTAMENTOS;
  const hoje = hojeSP();
  const ate = (typeof b.ate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.ate)) ? b.ate : hoje;
  const de = (typeof b.de === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.de)) ? b.de : `${hoje.slice(0, 8)}01`;
  const dentro = (iso) => !!iso && iso.slice(0, 10) >= de && iso.slice(0, 10) <= ate;

  if (!deps.length) {
    return res.status(200).json({ ok: true, periodo: { de, ate }, deps: [], por_dep: {}, risco: null, termometro: null, fila: null, serie: [], por_colaborador: [], pendencias: [] });
  }

  const [cardsR, colabs] = await Promise.all([
    supabase.from('cards')
      .select('departamento,status,prioridade,resolvido_em,created_at,responsavel_id,cod_alu,nome_aluno,nome_responsavel,titulo')
      .eq('unit_id', unitId).in('departamento', deps),
    listarColaboradores(unitId)
  ]);
  const todos = cardsR.data || [];
  const nomeDe = new Map(colabs.map((c) => [c.id, c.nome || c.email]));

  // KPIs por departamento (abertos, alta, resolvidos no período, aguardando)
  const por_dep = {};
  for (const d of deps) {
    const cs = todos.filter((c) => c.departamento === d);
    por_dep[d] = {
      abertos: cs.filter((c) => c.status !== 'resolvido').length,
      alta: cs.filter((c) => c.status !== 'resolvido' && c.prioridade === 'alta').length,
      resolvidos_periodo: cs.filter((c) => c.status === 'resolvido' && dentro(c.resolvido_em)).length,
      aguardando: cs.filter((c) => c.status === 'aguardando').length
    };
  }

  // Risco de evasão + termômetro (só pedagógico)
  let risco = null, termometro = null;
  if (deps.includes('pedagogico')) {
    const rc = todos.filter((c) => c.departamento === 'pedagogico' && (c.status === 'risco_evasao_1' || c.status === 'risco_evasao_2'));
    risco = {
      total: rc.length,
      nivel1: rc.filter((c) => c.status === 'risco_evasao_1').length,
      nivel2: rc.filter((c) => c.status === 'risco_evasao_2').length,
      novos_periodo: rc.filter((c) => dentro(c.created_at)).length
    };
    const { data: temps } = await supabase.from('aluno_termometro').select('faixa').eq('unit_id', unitId);
    const t = { quente: 0, morno: 0, frio: 0 };
    for (const x of (temps || [])) if (t[x.faixa] != null) t[x.faixa]++;
    termometro = t;
  }

  // Agência de Emprego — totais (encaminhados/contratados no período, vagas abertas)
  let agencia_kpi = null;
  if (deps.includes('encaminhamento')) {
    const [{ data: encR }, { data: vagasR }] = await Promise.all([
      supabase.from('encaminhamentos').select('status,created_at').eq('unit_id', unitId),
      supabase.from('vagas').select('status').eq('unit_id', unitId)
    ]);
    const enc = encR || [];
    agencia_kpi = {
      encaminhados_periodo: enc.filter((e) => dentro(e.created_at)).length,
      contratados_periodo: enc.filter((e) => e.status === 'contratado' && dentro(e.created_at)).length,
      vagas_abertas: (vagasR || []).filter((v) => ['aberta', 'triagem', 'processo'].includes(v.status)).length
    };
  }

  // Fila de mensagens no período (cobrança + faltantes)
  const { data: filaR } = await supabase.from('fila_mensagens')
    .select('origem,status,enviado_em,enfileirado_em,erro,telefone,alunos,categoria')
    .eq('unit_id', unitId).gte('enfileirado_em', `${de}T00:00:00-03:00`);
  const fl = filaR || [];
  const enviada = (m, origem) => m.status === 'enviado' && dentro(m.enviado_em) && (!origem || m.origem === origem);
  const fila = {
    na_fila: fl.filter((m) => m.status === 'enfileirado' || m.status === 'agendado').length,
    enviadas_periodo: fl.filter((m) => enviada(m)).length,
    erros: fl.filter((m) => m.status === 'erro').length, // falha real de envio (cancelado guarda nota em 'erro', não conta)
    cobranca: fl.filter((m) => enviada(m, 'regua_cobranca')).length,
    faltantes: fl.filter((m) => enviada(m, 'regua_faltantes')).length
  };

  // Lista dos erros reais (status='erro') para o botão "Erros" do painel.
  const erros_lista = fl.filter((m) => m.status === 'erro')
    .map((m) => ({ origem: m.origem, categoria: m.categoria || null, telefone: m.telefone || null, alunos: m.alunos || null, erro: m.erro || null, quando: m.enfileirado_em || null }))
    .slice(0, 100);

  // Série: faltantes identificados por dia (fila da régua de faltantes, exceto cancelados).
  // Serve pra acompanhar a curva de faltantes caindo ao longo do período.
  const faltMap = {};
  for (const m of fl) {
    if (m.origem === 'regua_faltantes' && m.status !== 'cancelado' && m.enfileirado_em) {
      const d = m.enfileirado_em.slice(0, 10);
      if (d >= de && d <= ate) faltMap[d] = (faltMap[d] || 0) + 1;
    }
  }
  const serie_faltantes = Object.entries(faltMap).map(([dia, n]) => ({ dia, n })).sort((a, b) => a.dia.localeCompare(b.dia));

  // Série: resolvidos por dia (todos os deps do usuário)
  const serieMap = {};
  for (const c of todos) {
    if (c.status === 'resolvido' && dentro(c.resolvido_em)) {
      const d = c.resolvido_em.slice(0, 10);
      serieMap[d] = (serieMap[d] || 0) + 1;
    }
  }
  const serie = Object.entries(serieMap).map(([dia, n]) => ({ dia, n })).sort((a, b) => a.dia.localeCompare(b.dia));

  // Produtividade por colaborador (resolvidos no período)
  const colabMap = {};
  for (const c of todos) {
    if (c.status === 'resolvido' && dentro(c.resolvido_em) && c.responsavel_id) {
      colabMap[c.responsavel_id] = (colabMap[c.responsavel_id] || 0) + 1;
    }
  }
  const por_colaborador = Object.entries(colabMap)
    .map(([id, n]) => ({ nome: nomeDe.get(id) || '—', n }))
    .sort((a, b) => b.n - a.n).slice(0, 10);

  // Pendências do dia (acionáveis agora): aguardando aluno + risco nascido hoje
  const pendencias = [];
  for (const c of todos) {
    if (c.status === 'aguardando') {
      pendencias.push({ tipo: 'aguardando', dep: c.departamento, titulo: c.titulo, nome: c.nome_aluno || c.nome_responsavel || null, cod_alu: c.cod_alu || null });
    } else if (c.departamento === 'pedagogico' && (c.status === 'risco_evasao_1' || c.status === 'risco_evasao_2') && (c.created_at || '').slice(0, 10) === hoje) {
      pendencias.push({ tipo: 'risco_novo', dep: 'pedagogico', titulo: c.titulo, nome: c.nome_aluno || null, cod_alu: c.cod_alu || null });
    }
  }

  return res.status(200).json({
    ok: true, periodo: { de, ate }, deps, por_dep, risco, termometro, agencia_kpi, fila, erros_lista, serie, serie_faltantes, por_colaborador,
    pendencias: pendencias.slice(0, 80)
  });
}

/**
 * Agência de Emprego (fase 1B) — CRUD de empresas parceiras e vagas, por unidade.
 * Só Supabase. Encaminhamentos/ocorrência/totais ficam para a 1C.
 */
async function agencia(res, acao, unitId, b) {
  if (acao === 'agencia_inicial') {
    const [emp, vag, enc] = await Promise.all([
      supabase.from('empresas_parceiras').select('*').eq('unit_id', unitId).order('nome'),
      supabase.from('vagas').select('*, empresa:empresas_parceiras(nome)').eq('unit_id', unitId).order('created_at', { ascending: false }),
      supabase.from('encaminhamentos').select('*, vaga:vagas(cargo), empresa:empresas_parceiras(nome)').eq('unit_id', unitId).order('created_at', { ascending: false }).limit(300)
    ]);
    return res.status(200).json({ ok: true, empresas: emp.data || [], vagas: vag.data || [], encaminhamentos: enc.data || [] });
  }

  if (acao === 'agencia_encaminhar') {
    if (!b.vaga_id) return res.status(400).json({ erro: 'sem_vaga' });
    const { data: vaga } = await supabase.from('vagas').select('id,cargo,empresa_id, empresa:empresas_parceiras(nome)').eq('id', b.vaga_id).eq('unit_id', unitId).maybeSingle();
    if (!vaga) return res.status(404).json({ erro: 'vaga_nao_encontrada' });
    const cod = b.cod_alu ? String(b.cod_alu) : null;
    const { data: enc, error } = await supabase.from('encaminhamentos').insert({
      unit_id: unitId, vaga_id: vaga.id, empresa_id: vaga.empresa_id,
      cod_alu: cod, nome_aluno: b.nome_aluno || null, telefone: b.telefone || null, status: 'encaminhado'
    }).select('*').single();
    if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
    if (cod) {
      await informativo(unitId, cod, `[Agência] Encaminhado para a vaga de ${vaga.cargo}${vaga.empresa?.nome ? ' na ' + vaga.empresa.nome : ''}.`);
      await supabase.from('encaminhamentos').update({ ocorrencia_em: new Date().toISOString() }).eq('id', enc.id).then(() => {}, () => {});
    }
    return res.status(200).json({ ok: true, encaminhamento: enc });
  }

  if (acao === 'agencia_enc_status') {
    const status = String(b.status || '');
    if (!['encaminhado', 'contratado', 'nao_contratado', 'nao_compareceu'].includes(status)) return res.status(400).json({ erro: 'status_invalido' });
    const patch = { status, updated_at: new Date().toISOString() };
    if ('feedback_empresa' in b) patch.feedback_empresa = b.feedback_empresa || null;
    const { data, error } = await supabase.from('encaminhamentos').update(patch).eq('id', b.id).eq('unit_id', unitId).select('*').single();
    if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
    if (status === 'contratado' && data?.vaga_id) {
      await supabase.from('vagas').update({ status: 'preenchida', updated_at: new Date().toISOString() }).eq('id', data.vaga_id).then(() => {}, () => {});
      if (data.cod_alu) await informativo(unitId, data.cod_alu, `[Agência] Contratado(a) na vaga encaminhada. 🎉`);
    }
    return res.status(200).json({ ok: true, encaminhamento: data });
  }

  if (acao === 'agencia_empresa_salvar') {
    const campos = {};
    for (const k of ['nome', 'razao_social', 'cnpj', 'endereco', 'bairro', 'cidade', 'uf', 'telefone', 'contato_rh', 'telefone_rh', 'email', 'status', 'observacoes']) {
      if (k in b) campos[k] = (b[k] === '' ? null : b[k]);
    }
    if (!campos.nome) return res.status(400).json({ erro: 'nome_obrigatorio' });
    if (b.id) {
      campos.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('empresas_parceiras').update(campos).eq('id', b.id).eq('unit_id', unitId).select('*').single();
      if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
      return res.status(200).json({ ok: true, empresa: data });
    }
    campos.unit_id = unitId;
    campos.origem = 'manual';
    if (!campos.status) campos.status = 'ativa';
    const { data, error } = await supabase.from('empresas_parceiras').insert(campos).select('*').single();
    if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
    return res.status(200).json({ ok: true, empresa: data });
  }

  if (acao === 'agencia_vaga_salvar') {
    const campos = {};
    for (const k of ['empresa_id', 'cargo', 'descricao', 'sexo', 'curso_alvo', 'requisitos', 'horario', 'beneficios', 'remuneracao', 'status']) {
      if (k in b) campos[k] = (b[k] === '' ? null : b[k]);
    }
    for (const n of ['qtd', 'qtd_disponivel', 'idade_min', 'idade_max']) {
      if (n in b) campos[n] = (b[n] === '' || b[n] == null ? null : Number(b[n]) || null);
    }
    if ('experiencia' in b) campos.experiencia = !!b.experiencia;
    if (!campos.cargo) return res.status(400).json({ erro: 'cargo_obrigatorio' });
    if (b.id) {
      campos.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('vagas').update(campos).eq('id', b.id).eq('unit_id', unitId).select('*, empresa:empresas_parceiras(nome)').single();
      if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
      return res.status(200).json({ ok: true, vaga: data });
    }
    campos.unit_id = unitId;
    if (!campos.status) campos.status = 'aberta';
    const { data, error } = await supabase.from('vagas').insert(campos).select('*, empresa:empresas_parceiras(nome)').single();
    if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
    return res.status(200).json({ ok: true, vaga: data });
  }

  return res.status(400).json({ erro: 'acao_invalida' });
}

function rotuloStatus(s) {
  return { novo: 'Novo', andamento: 'Em andamento', aguardando: 'Aguardando aluno', resolvido: 'Finalizado' }[s] || s;
}
async function evento(cardId, unitId, dep, tipo, descricao, eu) {
  await supabase.from('card_eventos').insert({
    card_id: cardId, unit_id: unitId, departamento: dep, tipo, descricao,
    autor_id: eu?.id || null, autor_nome: eu?.nome || null
  });
  await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);
}
