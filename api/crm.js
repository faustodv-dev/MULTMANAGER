import { supabase, usuarioDaRequisicao, podeModulo, lerCorpo, hojeSP, digitos, reais, dataBr } from './_lib/base.js';
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
      return res.status(200).json({ ok: true, card, eventos: eventos || [], boletos: boletos || [], historico });
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
