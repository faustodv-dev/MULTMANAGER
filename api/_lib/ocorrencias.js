import { supabase, registrar } from './base.js';
import { ponte } from './ponte.js';

/**
 * Ocorrência informativa por mensagem enviada.
 * A cada mensagem da fila que o gateway já ENVIOU (status=enviado, com enviado_em real),
 * grava no sistema MULT (via ponte -> s_cad_ocorrencia, tipo "Informativo") uma nota simples
 * dizendo que a mensagem foi enviada naquela data/hora. Não cria card no CRM — é só registro.
 *
 * Idempotente: a chave `ocofila|<id da fila>` dedup na própria ponte, então re-rodar não duplica.
 * O card no CRM nasce só quando há interação que o agente não resolve (fluxo à parte).
 */

const ROTULO_ETAPA = {
  justificada: 'falta justificada',
  falta1: '1ª falta',
  consec2: '2 faltas seguidas',
  consec3: '3 faltas seguidas'
};

function dataHoraSP(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${data} às ${hora}`;
}

// Detalhe por turma (números ficam SÓ no CRM, nunca no WhatsApp do responsável).
function detalheTurmas(meta) {
  const ts = meta && Array.isArray(meta.turmas) ? meta.turmas : [];
  if (!ts.length) return '';
  const partes = ts.map((t) => {
    const fs = Number(t.faltas_seguidas || 0);
    const info = fs > 0 ? ` (${fs} falta${fs > 1 ? 's' : ''} seg.)` : '';
    return `${t.turma || '?'}${info}`;
  });
  return ` Turmas: ${partes.join('; ')}.`;
}

function textoOcorrencia(row) {
  const origem = row.origem === 'regua_faltantes' ? 'régua de faltantes' : 'régua de cobrança';
  const rot = ROTULO_ETAPA[row.categoria];
  const etapa = rot ? ` – ${rot}` : '';
  return `📲 Contato automático (${origem}${etapa}) enviado ao WhatsApp do responsável em ${dataHoraSP(row.enviado_em)}.${detalheTurmas(row.metadata)} [MULT Manager]`;
}

// Erros de negócio que não adianta repetir: marca como tratada pra não ficar em loop.
const ERROS_PERMANENTES = ['aluno_nao_encontrado', 'texto_invalido', 'tipo_proibido', 'matricula_nao_encontrada'];

/**
 * Varre as mensagens já enviadas sem ocorrência registrada e grava uma por uma.
 * Chamado pelo endpoint /api/ocorrencias (cutucado pelo gateway a cada ~60s).
 */
export async function flushOcorrenciasEnviadas({ limite = 150 } = {}) {
  const { data: rows, error } = await supabase
    .from('fila_mensagens')
    .select('id, unit_id, cod_alu, categoria, origem, enviado_em, metadata')
    .eq('status', 'enviado')
    .is('ocorrencia_em', null)
    .not('cod_alu', 'is', null)
    .order('enviado_em', { ascending: true })
    .limit(limite);

  const resumo = { candidatos: (rows || []).length, gravadas: 0, erros: 0 };
  if (error || !rows || !rows.length) return resumo;

  for (const row of rows) {
    const texto = textoOcorrencia(row);
    const matricula = row.metadata && row.metadata.matricula ? String(row.metadata.matricula) : '';
    try {
      await ponte(row.unit_id, 'registrar_ocorrencia', {
        cod_alu: String(row.cod_alu), matricula, texto, chave: `ocofila|${row.id}`
      }, { timeoutMs: 20000 });
      await supabase.from('fila_mensagens').update({ ocorrencia_em: new Date().toISOString(), ocorrencia_erro: null }).eq('id', row.id);
      resumo.gravadas++;
    } catch (e) {
      resumo.erros++;
      const patch = { ocorrencia_erro: String(e.codigo || e.message || 'erro').slice(0, 200) };
      if (ERROS_PERMANENTES.includes(e.codigo)) patch.ocorrencia_em = new Date().toISOString();
      await supabase.from('fila_mensagens').update(patch).eq('id', row.id).then(() => {}, () => {});
    }
  }

  if (resumo.candidatos) await registrar('ocorrencias', 'flush', resumo.erros === 0, { detalhe: resumo });
  return resumo;
}
