import { usuarioDaRequisicao, lerCorpo, digitos } from './_lib/base.js';
import { ponte } from './_lib/ponte.js';
import { obterOuCriarConversa, atualizarConversa, segredosUnidade } from './_lib/conversa.js';
import { prepararCobranca, emitirCobranca } from './_lib/cobranca.js';

export const config = { maxDuration: 60 };

const TELEFONE_TESTE = 'painel-teste';

/** Conversa dedicada ao teste de boleto do painel (uma por unidade, canal "teste"). */
async function conversaTeste(unitId) {
  return obterOuCriarConversa(unitId, TELEFONE_TESTE, { nome: 'Teste do painel', canal: 'teste' });
}

/**
 * Emissão de boleto REAL pelo painel — só master. Mesmas travas da assistente:
 * dois passos (prévia que mostra nome/vencimento/valor, depois emitir) e sem duplicar.
 * O boleto fica marcado no sistema escolar como "PAINEL ADMIN (TESTE)".
 * Corpo: { acao:'buscar'|'preparar'|'emitir', unidade, cpf?, cod_alu?, vencimento? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'metodo' });
  const eu = await usuarioDaRequisicao(req);
  if (!eu || eu.papel !== 'master') return res.status(403).json({ erro: 'sem_permissao' });

  const b = await lerCorpo(req);
  const unitId = String(b.unidade || '').trim();
  if (!unitId) return res.status(400).json({ erro: 'parametros', mensagem: 'Informe a unidade.' });
  const acao = String(b.acao || '');

  try {
    // 1) Procura o cadastro pelo CPF (do responsável ou do aluno) e lista os alunos.
    if (acao === 'buscar') {
      const cpf = digitos(b.cpf);
      if (cpf.length !== 11) return res.status(400).json({ erro: 'cpf_invalido', mensagem: 'CPF precisa ter 11 dígitos.' });
      const gs = await ponte(unitId, 'buscar_cpf', { cpf });
      const grupos = (gs || []).map((g) => ({
        nome_responsavel: g.nome_responsavel,
        cpf_responsavel: g.cpf_responsavel,
        alunos: (g.alunos || []).map((a) => ({ cod_alu: a.cod_alu, nome: a.nome, ativo: a.ativo }))
      }));
      return res.status(200).json({ ok: true, grupos });
    }

    // 2) Monta a prévia (sem emitir nada): confirma identidade do grupo e calcula o valor.
    if (acao === 'preparar') {
      const cpf = digitos(b.cpf);
      const codAlu = String(b.cod_alu || '');
      if (cpf.length !== 11 || !codAlu) return res.status(400).json({ erro: 'parametros', mensagem: 'Informe CPF e aluno.' });

      const gs = await ponte(unitId, 'buscar_cpf', { cpf });
      const grupo = (gs || []).find((g) => (g.alunos || []).some((a) => String(a.cod_alu) === codAlu));
      if (!grupo) return res.status(404).json({ erro: 'aluno_nao_encontrado', mensagem: 'Esse aluno não está no cadastro desse CPF.' });

      let conversa = await conversaTeste(unitId);
      conversa = await atualizarConversa(conversa.id, {
        identidade_confirmada: true,
        cpf_responsavel: grupo.cpf_responsavel || null,
        nome_responsavel: grupo.nome_responsavel || null,
        cod_alus: (grupo.alunos || []).map((a) => String(a.cod_alu)),
        contexto: {
          grupo: { nome_responsavel: grupo.nome_responsavel, cpf_responsavel: grupo.cpf_responsavel, alunos: grupo.alunos },
          forma: 'painel_master',
          cobranca_preparada: null
        }
      });

      const previa = await prepararCobranca({ conversa, codAlu, vencimentoBr: b.vencimento || null });
      if (previa.erro) return res.status(200).json({ ok: false, ...previa });
      return res.status(200).json({ ok: true, previa });
    }

    // 3) Emite o boleto REAL no Asaas a partir da prévia confirmada.
    if (acao === 'emitir') {
      const conversa = await conversaTeste(unitId);
      if (!conversa.contexto?.cobranca_preparada) {
        return res.status(400).json({ erro: 'prepare_primeiro', mensagem: 'Monte a prévia antes de emitir.' });
      }
      const segredos = await segredosUnidade(unitId);
      if (!segredos.asaas) return res.status(400).json({ erro: 'asaas_nao_configurado', mensagem: 'Unidade sem chave Asaas.' });
      const r = await emitirCobranca({ conversa, segredos, via: 'painel' });
      if (r.erro) return res.status(200).json({ ok: false, ...r });
      return res.status(200).json({ ok: true, resultado: r });
    }

    return res.status(400).json({ erro: 'acao_invalida' });
  } catch (e) {
    return res.status(500).json({ erro: e.codigo || 'erro', mensagem: e.message, detalhes: e.detalhes });
  }
}
