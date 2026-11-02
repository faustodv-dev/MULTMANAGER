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
/** Para cada frequência: período de referência, data prevista e prazo do período atual. */
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
  // mensal
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { ref: mes, data: `${mes}-01`, prazo: iso(ultimo) };
}

/** Cria as execuções do período atual para os POPs ativos (idempotente). */
async function gerarExecucoes(unitId, departamento) {
  const { data: pops } = await supabase.from('pops').select('*').eq('unit_id', unitId).eq('departamento', departamento).eq('ativo', true);
  const hoje = emSP();
  for (const pop of pops || []) {
    const p = periodoDoPop(pop, hoje);
    await supabase.from('pop_execucoes').insert({
      unit_id: unitId, pop_id: pop.id, departamento, titulo: pop.titulo, procedimento: pop.procedimento,
      frequencia: pop.frequencia, periodo_ref: p.ref, data_prevista: p.data, prazo: p.prazo,
      responsavel_id: null
    }); // conflito (unit,pop,periodo) é ignorado
  }
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

  try {
    /* ───────── Kanban: cards ───────── */
    if (acao === 'cards_listar') {
      // Kanban mostra só atendimentos em aberto; finalizados somem (ficam no histórico do aluno).
      const { data } = await supabase.from('cards').select('*').eq('unit_id', unitId).eq('departamento', dep)
        .neq('status', 'resolvido')
        .order('prioridade', { ascending: true }).order('updated_at', { ascending: false });
      return res.status(200).json({ ok: true, cards: data || [] });
    }

    if (acao === 'card_criar') {
      // Cada card é um atendimento (demanda) próprio — não deduplica por aluno.
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
      const patch = { status: String(b.status || 'novo') };
      patch.resolvido_em = patch.status === 'resolvido' ? new Date().toISOString() : null;
      const { data } = await supabase.from('cards').update(patch).eq('id', b.card_id).eq('unit_id', unitId).select('*').single();
      await evento(b.card_id, unitId, dep, 'status', `Status: ${rotuloStatus(patch.status)}`, eu);
      return res.status(200).json({ ok: true, card: data });
    }

    if (acao === 'card_atualizar') {
      const patch = {};
      for (const k of ['titulo', 'descricao', 'prioridade', 'responsavel_id', 'prazo']) if (k in b) patch[k] = b[k] || null;
      const { data } = await supabase.from('cards').update(patch).eq('id', b.card_id).eq('unit_id', unitId).select('*').single();
      return res.status(200).json({ ok: true, card: data });
    }

    if (acao === 'card_evento') {
      await evento(b.card_id, unitId, dep, b.tipo || 'nota', String(b.descricao || '').slice(0, 1000), eu);
      return res.status(200).json({ ok: true });
    }

    if (acao === 'card_dossie') {
      const { data: card } = await supabase.from('cards').select('*').eq('id', b.card_id).eq('unit_id', unitId).maybeSingle();
      if (!card) return res.status(404).json({ erro: 'card_nao_encontrado' });
      const { data: eventos } = await supabase.from('card_eventos').select('*').eq('card_id', card.id).order('criado_em', { ascending: false }).limit(200);
      const { data: boletos } = await supabase.from('cobrancas_asaas').select('*').eq('unit_id', unitId).eq('cod_alu', card.cod_alu || '___').order('created_at', { ascending: false }).limit(20);
      let financeiro = null;
      let historico = [];
      if (card.cod_alu) {
        try {
          const r = await ponte(unitId, 'parcelas', { cod_alus: [card.cod_alu], data_referencia: hojeSP() });
          const hoje = hojeSP();
          financeiro = (r.documentos || []).map((d) => ({
            vencimento: dataBr(d.vencimento), parcelas: d.cod_pars, vencida: d.vencimento < hoje,
            valor_hoje: reais(d.valor_devido), valor_em_dia: reais(d.valor_em_dia)
          }));
        } catch (e) { financeiro = { erro: e.message }; }
        // Histórico do aluno: todos os cards dele na unidade (qualquer departamento), inclusive finalizados.
        const { data: hist } = await supabase.from('cards').select('id, departamento, titulo, status, prioridade, created_at, resolvido_em')
          .eq('unit_id', unitId).eq('cod_alu', card.cod_alu).neq('id', card.id).order('created_at', { ascending: false }).limit(50);
        historico = hist || [];
      }
      return res.status(200).json({ ok: true, card, eventos: eventos || [], boletos: boletos || [], financeiro, historico });
    }

    /* ───────── Buscar aluno no sistema escolar (p/ criar card) ───────── */
    if (acao === 'buscar_aluno') {
      const cpf = digitos(b.cpf);
      const fone = digitos(b.telefone);
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
      const { data } = await supabase.from('pop_execucoes').select('*').eq('unit_id', unitId).eq('departamento', dep)
        .in('status', ['a_fazer', 'fazendo', 'feito'])
        .order('data_prevista', { ascending: true });
      // só o período corrente (mês atual + semana + hoje)
      const mes = hojeSP().slice(0, 7);
      const atual = (data || []).filter((e) => (e.periodo_ref || '').startsWith(mes.slice(0, 4)) && (e.periodo_ref === hojeSP() || e.periodo_ref.startsWith(mes) || e.periodo_ref.includes('-W')));
      return res.status(200).json({ ok: true, execucoes: atual });
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

    /* ───────── Admin: catálogo de POPs (incluir/editar/excluir) ───────── */
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
      // Desativa (mantém histórico das execuções já registradas).
      await supabase.from('pops').update({ ativo: false }).eq('id', b.id).eq('unit_id', unitId);
      return res.status(200).json({ ok: true });
    }

    /* ───────── Colaboradores (dropdown de responsável) ───────── */
    if (acao === 'colaboradores') {
      const { data } = await supabase.from('profiles').select('id, nome, email, papel').eq('unit_id', unitId).eq('ativo', true).order('nome');
      return res.status(200).json({ ok: true, colaboradores: data || [] });
    }

    /* ───────── Produtividade ───────── */
    if (acao === 'produtividade') {
      const hoje = hojeSP();
      const mes = hoje.slice(0, 7);
      const { data: cards } = await supabase.from('cards').select('status, prioridade, resolvido_em').eq('unit_id', unitId).eq('departamento', dep);
      const { data: execs } = await supabase.from('pop_execucoes').select('status, prazo, periodo_ref, concluido_em').eq('unit_id', unitId).eq('departamento', dep);
      const execMes = (execs || []).filter((e) => (e.periodo_ref || '').startsWith(mes) || e.periodo_ref === hoje || e.periodo_ref.includes('-W'));
      const abertosCards = (cards || []).filter((c) => c.status !== 'resolvido');
      const abertos = abertosCards.length;
      const alta = abertosCards.filter((c) => c.prioridade === 'alta').length;
      const resolvidosMes = (cards || []).filter((c) => c.status === 'resolvido' && (c.resolvido_em || '').slice(0, 7) === mes).length;
      const popsFeitos = execMes.filter((e) => e.status === 'feito').length;
      const popsAtrasados = execMes.filter((e) => e.status !== 'feito' && e.prazo && e.prazo < hoje).length;
      const popsHoje = execMes.filter((e) => e.periodo_ref === hoje);
      return res.status(200).json({
        ok: true,
        resumo: {
          atendimentos_abertos: abertos, atendimentos_alta: alta, atendimentos_resolvidos_mes: resolvidosMes,
          atendimentos_total: (cards || []).length,
          pops_feitos: popsFeitos, pops_total: execMes.length,
          pops_pct: execMes.length ? Math.round((popsFeitos / execMes.length) * 100) : 0,
          pops_atrasados: popsAtrasados,
          pops_hoje_feitos: popsHoje.filter((e) => e.status === 'feito').length, pops_hoje_total: popsHoje.length
        }
      });
    }

    return res.status(400).json({ erro: 'acao_invalida' });
  } catch (e) {
    return res.status(500).json({ erro: e.codigo || 'erro', mensagem: e.message, detalhes: e.detalhes });
  }
}

function rotuloStatus(s) {
  return { novo: 'Novo', andamento: 'Em andamento', aguardando: 'Aguardando aluno', resolvido: 'Resolvido' }[s] || s;
}

async function evento(cardId, unitId, dep, tipo, descricao, eu) {
  await supabase.from('card_eventos').insert({
    card_id: cardId, unit_id: unitId, departamento: dep, tipo, descricao,
    autor_id: eu?.id || null, autor_nome: eu?.nome || null
  });
  await supabase.from('cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId);
}
