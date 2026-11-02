import { supabase, usuarioDaRequisicao, lerCorpo } from './_lib/base.js';

const MODULOS = ['atendimento', 'comprovantes', 'financeiro', 'pedagogico', 'encaminhamento', 'configuracoes'];
const TODAS = ['atendimento', 'comprovantes', 'financeiro', 'pedagogico', 'encaminhamento'];

/** Admins do CRM comercial para importar (só nome, e-mail e unidade; sem senha). */
const ADMINS_COMERCIAL = [
  { nome: 'Oesley Tavares', email: 'soformacaoprofissional@gmail.com', unit: 'agua_boa', unitName: 'Água Boa' },
  { nome: 'ERICO VERISSIMO', email: 'anapolis@multprofissoes.com.br', unit: 'anapolis', unitName: 'Anápolis' },
  { nome: 'JALISON SILVA CHAGAS', email: 'jalisonmltchagas@gmail.com', unit: 'aparecida_goiania', unitName: 'Aparecida de Goiânia' },
  { nome: 'Vinicius Leandro Rocha Silva', email: 'viniciussilva1234lr@gmail.com', unit: 'bom_jesus', unitName: 'Bom Jesus' },
];

const senhaPadrao = (nome) =>
  String(nome || '').trim().split(/\s+/)[0].normalize('NFD').replace(/[^a-zA-Z]/g, '').toUpperCase() + '123';

async function garantirUnidade(id, name) {
  const { data: u } = await supabase.from('units').select('id').eq('id', id).maybeSingle();
  if (u) return;
  await supabase.from('units').insert({ id, name });
  await supabase.from('unit_secrets').insert({ unit_id: id }).then(() => {}, () => {});
  const { data: pops } = await supabase.from('pops')
    .select('departamento, titulo, procedimento, frequencia, dia_do_mes, responsavel_sugerido, ordem')
    .eq('unit_id', 'rio_verde').eq('ativo', true);
  if (pops?.length) await supabase.from('pops').insert(pops.map((p) => ({ ...p, unit_id: id })));
}

/**
 * Master: cria qualquer usuário e importa admins. Admin de unidade: cria colaboradores/coordenadores da própria unidade.
 * Ações: criar | senha | importar_admins
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const eu = await usuarioDaRequisicao(req);
  if (!eu || (eu.papel !== 'master' && eu.papel !== 'admin')) return res.status(403).json({ erro: 'sem_permissao' });
  const b = await lerCorpo(req);

  if (b.acao === 'criar') {
    const email = String(b.email || '').trim().toLowerCase();
    const senha = String(b.senha || '');
    const papel = ['admin', 'coordenador', 'colaborador'].includes(b.papel) ? b.papel : 'colaborador';
    const unitId = eu.papel === 'master' ? String(b.unit_id || '') : eu.unit_id;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || senha.length < 6 || !unitId) {
      return res.status(400).json({ erro: 'parametros', mensagem: 'E-mail válido, senha com 6+ caracteres e unidade são obrigatórios.' });
    }
    if (eu.papel === 'admin' && papel === 'admin') return res.status(403).json({ erro: 'so_master_cria_admin', mensagem: 'Só o master cria admin.' });
    const { data, error } = await supabase.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome: b.nome || '' } });
    if (error) return res.status(400).json({ erro: 'falha_criar', mensagem: error.message });
    const modulos = papel === 'admin' ? MODULOS : papel === 'coordenador' ? TODAS : (Array.isArray(b.modulos) ? b.modulos : []).filter((m) => MODULOS.includes(m));
    await supabase.from('profiles').update({
      nome: String(b.nome || '').slice(0, 120), papel, unit_id: unitId, departamento: b.departamento || null,
      modulos, ativo: true
    }).eq('id', data.user.id);
    return res.status(200).json({ ok: true, id: data.user.id });
  }

  if (b.acao === 'senha') {
    const { data: alvo } = await supabase.from('profiles').select('*').eq('id', b.user_id).maybeSingle();
    if (!alvo) return res.status(404).json({ erro: 'nao_encontrado' });
    const podeMexer = eu.papel === 'master' || (eu.papel === 'admin' && alvo.unit_id === eu.unit_id && alvo.papel !== 'master' && alvo.papel !== 'admin');
    if (!podeMexer) return res.status(403).json({ erro: 'sem_permissao' });
    if (String(b.senha || '').length < 6) return res.status(400).json({ erro: 'senha_curta' });
    const { error } = await supabase.auth.admin.updateUserById(alvo.id, { password: String(b.senha) });
    if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
    return res.status(200).json({ ok: true });
  }

  if (b.acao === 'importar_admins') {
    if (eu.papel !== 'master') return res.status(403).json({ erro: 'sem_permissao' });
    const out = [];
    for (const a of ADMINS_COMERCIAL) {
      await garantirUnidade(a.unit, a.unitName);
      const email = a.email.toLowerCase();
      const { data: existe } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      if (existe) {
        await supabase.from('profiles').update({ papel: 'admin', unit_id: a.unit, modulos: MODULOS, ativo: true, nome: a.nome }).eq('id', existe.id);
        out.push({ nome: a.nome, email, unidade: a.unit, status: 'ja_existia' });
        continue;
      }
      const senha = senhaPadrao(a.nome);
      const { data, error } = await supabase.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome: a.nome } });
      if (error) { out.push({ nome: a.nome, email, status: 'erro', erro: error.message }); continue; }
      await supabase.from('profiles').update({ nome: a.nome, papel: 'admin', unit_id: a.unit, modulos: MODULOS, ativo: true }).eq('id', data.user.id);
      out.push({ nome: a.nome, email, unidade: a.unit, senha, status: 'criado' });
    }
    return res.status(200).json({ ok: true, resultado: out });
  }

  return res.status(400).json({ erro: 'acao_invalida' });
}
