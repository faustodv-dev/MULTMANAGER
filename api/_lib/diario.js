import { createClient } from '@supabase/supabase-js';

// De-para unidade (nosso CRM) → franquia (Diário). Só estas 2 unidades têm Diário hoje.
const DEPARA = { rio_verde: 'rio-verde', aparecida_goiania: 'aparecida' };

export const unidadeTemDiario = (unitId) => Boolean(DEPARA[unitId]);

let _cli = null;
function cliente() {
  const url = process.env.DIARIO_SUPABASE_URL;
  const key = process.env.DIARIO_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  if (!_cli) _cli = createClient(url, key, { auth: { persistSession: false } });
  return _cli;
}

// Pega o 1º campo presente dentre vários nomes possíveis (schema do Diário veio de print,
// então mapeamos defensivamente — se algum não casar, é só acrescentar o nome real aqui).
const pega = (obj, chaves) => {
  for (const k of chaves) if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  return null;
};

/**
 * Lê o Diário de Bordo de um aluno direto no Supabase do Diário (2º cliente, só no
 * servidor). A leitura bate na quota do PROJETO DO DIÁRIO, sob demanda — não toca
 * no nosso egress. Identidade: missoes.student_id == `${franquia}_${cod_alu}`.
 */
export async function diarioDoAluno(unitId, codAlu) {
  const franquia = DEPARA[unitId];
  if (!franquia) return { tem_diario: false, entradas: [], perfil: null, total: 0 };
  const cli = cliente();
  if (!cli) throw new Error('Diário não configurado (DIARIO_SUPABASE_URL/KEY ausentes).');

  const studentId = `${franquia}_${codAlu}`;
  const { data: rows, error } = await cli.from('missoes').select('*').eq('student_id', studentId).limit(100);
  if (error) throw new Error(`Diário: ${error.message}`);

  const entradas = (rows || []).map((r) => ({
    modulo: pega(r, ['modulo', 'module', 'modulo_nome']),
    aula: pega(r, ['aula', 'lesson', 'aula_nome', 'aula_numero']),
    curso: pega(r, ['course_name', 'curso', 'curso_nome']),
    turma: pega(r, ['turma']),
    status: pega(r, ['status']),
    texto: pega(r, ['conteudo', 'diario', 'texto', 'report', 'descricao', 'content', 'anotacao', 'learning', 'conteudo_diario', 'aprendizado']),
    data: pega(r, ['created_at', 'data', 'submitted_at', 'date', 'data_envio', 'enviado_em', 'updated_at']),
  }));
  entradas.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  let perfil = null;
  try {
    const { data: u } = await cli.from('usuarios').select('*').eq('id', studentId).maybeSingle();
    if (u) perfil = { nome: pega(u, ['display_name', 'nome', 'name']), role: pega(u, ['role']), xp: pega(u, ['xp', 'pontos', 'xp_total']) };
  } catch { /* perfil é opcional */ }

  return { tem_diario: true, entradas, perfil, total: entradas.length };
}
