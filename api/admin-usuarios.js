import { supabase, usuarioDaRequisicao, lerCorpo } from './_lib/base.js';

const MODULOS = ['atendimento', 'comprovantes', 'financeiro', 'configuracoes'];

/**
 * Master: cria qualquer usuário. Admin de unidade: cria colaboradores da própria unidade.
 * Ações: criar { email, senha, nome, papel, unit_id, departamento, modulos } | senha { user_id, senha }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const eu = await usuarioDaRequisicao(req);
  if (!eu || (eu.papel !== 'master' && eu.papel !== 'admin')) return res.status(403).json({ erro: 'sem_permissao' });
  const b = await lerCorpo(req);

  if (b.acao === 'criar') {
    const email = String(b.email || '').trim().toLowerCase();
    const senha = String(b.senha || '');
    const papel = ['admin', 'colaborador'].includes(b.papel) ? b.papel : 'colaborador';
    const unitId = eu.papel === 'master' ? String(b.unit_id || '') : eu.unit_id;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || senha.length < 8 || !unitId) {
      return res.status(400).json({ erro: 'parametros', mensagem: 'E-mail válido, senha com 8+ caracteres e unidade são obrigatórios.' });
    }
    if (eu.papel === 'admin' && papel === 'admin') return res.status(403).json({ erro: 'so_master_cria_admin' });
    const { data, error } = await supabase.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome: b.nome || '' } });
    if (error) return res.status(400).json({ erro: 'falha_criar', mensagem: error.message });
    const modulos = (Array.isArray(b.modulos) ? b.modulos : []).filter((m) => MODULOS.includes(m));
    await supabase.from('profiles').update({
      nome: String(b.nome || '').slice(0, 120), papel, unit_id: unitId, departamento: b.departamento || null,
      modulos: papel === 'admin' ? MODULOS : modulos, ativo: true
    }).eq('id', data.user.id);
    return res.status(200).json({ ok: true, id: data.user.id });
  }

  if (b.acao === 'senha') {
    const { data: alvo } = await supabase.from('profiles').select('*').eq('id', b.user_id).maybeSingle();
    if (!alvo) return res.status(404).json({ erro: 'nao_encontrado' });
    const podeMexer = eu.papel === 'master' || (eu.papel === 'admin' && alvo.unit_id === eu.unit_id && alvo.papel === 'colaborador');
    if (!podeMexer) return res.status(403).json({ erro: 'sem_permissao' });
    if (String(b.senha || '').length < 8) return res.status(400).json({ erro: 'senha_curta' });
    const { error } = await supabase.auth.admin.updateUserById(alvo.id, { password: String(b.senha) });
    if (error) return res.status(400).json({ erro: 'falha', mensagem: error.message });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ erro: 'acao_invalida' });
}
