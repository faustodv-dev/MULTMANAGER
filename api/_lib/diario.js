import { createClient } from '@supabase/supabase-js';

// De-para unidade (nosso CRM) → franquia (Diário). Só estas 2 unidades têm Diário hoje.
const DEPARA = { rio_verde: 'rio-verde', aparecida_goiania: 'aparecida' };
const STATUS_PT = { approved: 'aprovado', pending: 'pendente', rejected: 'rejeitado', submitted: 'enviado' };

export const unidadeTemDiario = (unitId) => Boolean(DEPARA[unitId]);

let _cli = null;
function cliente() {
  const url = process.env.DIARIO_SUPABASE_URL;
  const key = process.env.DIARIO_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  if (!_cli) _cli = createClient(url, key, { auth: { persistSession: false } });
  return _cli;
}

/**
 * Lê o Diário de Bordo de um aluno direto no Supabase do Diário (2º cliente, só no
 * servidor). A leitura bate na quota do PROJETO DO DIÁRIO, sob demanda — não toca
 * no nosso egress. Identidade: missoes.student_id == `${franquia}_${cod_alu}`.
 * Colunas confirmadas: module, class_num, content, status, ai_feedback, xp_awarded, created_at.
 */
export async function diarioDoAluno(unitId, codAlu) {
  const franquia = DEPARA[unitId];
  if (!franquia) return { tem_diario: false, entradas: [], perfil: null, total: 0 };
  const cli = cliente();
  if (!cli) throw new Error('Diário não configurado (DIARIO_SUPABASE_URL/KEY ausentes).');

  const studentId = `${franquia}_${codAlu}`;
  const { data: rows, error } = await cli
    .from('missoes')
    .select('module, class_num, course_name, turma, status, content, ai_feedback, xp_awarded, created_at, student_name')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Diário: ${error.message}`);

  const entradas = (rows || []).map((r) => ({
    modulo: r.module || null,
    aula: r.class_num != null ? `Aula ${r.class_num}` : null,
    curso: r.course_name || null,
    turma: r.turma || null,
    status: STATUS_PT[r.status] || r.status || null,
    texto: r.content || null,
    feedback: r.ai_feedback || null,
    xp: r.xp_awarded ?? null,
    data: r.created_at || null,
  }));

  // XP total = soma do xp concedido nas missões (o Diário não guarda total em usuarios).
  const totalXp = (rows || []).reduce((s, r) => s + (Number(r.xp_awarded) || 0), 0);
  const nome = rows && rows[0] ? rows[0].student_name : null;

  return { tem_diario: true, entradas, perfil: { nome, xp: totalXp }, total: entradas.length };
}
