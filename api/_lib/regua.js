import { supabase, reais, dataBr, hojeSP, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enviarWhatsapp } from './gateway.js';

/**
 * Régua de cobrança (disparo automático e manual de mensagens no WhatsApp).
 * Cada unidade tem a sua régua; quando `regua` é null na unidade, vale este padrão.
 * Variáveis dos textos: {responsavel} {aluno} {valor} {vencimento}
 */

// Status da matrícula financeira (s_cad_matricula.STATUS_MAT). Mesmos em todas as unidades.
export const STATUS_CANONICOS = ['Ativo', 'Desistente', 'Rescindido', 'Trancado', 'Formado'];

export const REGUA_PADRAO = {
  ativa: false, // a unidade liga quando o WhatsApp estiver conectado
  horario: 9,
  pula_domingo: true,
  statuses: ['Ativo'], // só cobra matrícula ativa, por padrão
  passos: [
    { offset: -3, ativo: true, texto: 'Oi, {responsavel}! 😊 Passando pra lembrar que a mensalidade de {aluno} ({valor}) vence em {vencimento}. Pagando até o vencimento você garante o desconto de pontualidade. Se quiser o boleto ou o Pix, é só responder aqui que eu te mando!' },
    { offset: 0, ativo: true, texto: 'Olá, {responsavel}! A mensalidade de {aluno} ({valor}) vence hoje ({vencimento}). Dá pra pagar por boleto ou Pix — me responde aqui que eu envio na hora. 😉' },
    { offset: 1, ativo: true, texto: 'Oi, {responsavel}! Vi que a mensalidade de {aluno}, com vencimento em {vencimento}, ficou em aberto. Acontece! Quer que eu gere a segunda via por boleto ou Pix (já com o valor atualizado)? É só responder aqui. 🙂' },
    { offset: 7, ativo: true, texto: 'Olá, {responsavel}! A mensalidade de {aluno} venceu em {vencimento} e segue em aberto. Posso te enviar o boleto já com o valor atualizado ou o Pix agora mesmo — responde aqui que a gente resolve juntos. 😊' },
    { offset: 15, ativo: true, texto: 'Oi, {responsavel}. A mensalidade de {aluno} está vencida desde {vencimento}. Pra evitar que o débito aumente, vamos resolver? Me responde aqui que eu te mando o boleto atualizado ou o Pix, ou combino um prazo com você.' },
    { offset: 30, ativo: true, texto: 'Olá, {responsavel}. A mensalidade de {aluno} está em aberto há cerca de 30 dias (desde {vencimento}). Precisamos regularizar para manter a matrícula em dia. Me responde aqui hoje que eu te ajudo com o pagamento ou com um acordo. 🙏' }
  ]
};

export function rotuloOffset(o) {
  const n = Math.abs(Number(o));
  if (o < 0) return `${n} dia${n > 1 ? 's' : ''} antes de vencer`;
  if (o === 0) return 'no dia do vencimento';
  return `${n} dia${n > 1 ? 's' : ''} depois de vencer`;
}

/** Mescla a config salva com o padrão (preenche o que faltar; mantém passos extras). */
export function mesclarRegua(salva) {
  const base = JSON.parse(JSON.stringify(REGUA_PADRAO));
  if (!salva || typeof salva !== 'object') return base;
  const salvos = Array.isArray(salva.passos) ? salva.passos : [];
  const porOffset = new Map(salvos.map((p) => [Number(p.offset), p]));
  const passos = base.passos.map((p) => {
    const s = porOffset.get(p.offset);
    return s ? { offset: p.offset, ativo: s.ativo !== false, texto: String(s.texto || p.texto) } : p;
  });
  for (const s of salvos) {
    const off = Number(s.offset);
    if (Number.isInteger(off) && !base.passos.some((p) => p.offset === off) && s.texto) {
      passos.push({ offset: off, ativo: s.ativo !== false, texto: String(s.texto) });
    }
  }
  passos.sort((a, b) => a.offset - b.offset);
  let statuses = Array.isArray(salva.statuses) ? salva.statuses.map((x) => String(x).trim()).filter(Boolean) : [];
  if (!statuses.length) statuses = [...base.statuses];
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    pula_domingo: salva.pula_domingo !== false,
    statuses,
    passos
  };
}

export async function reguaDaUnidade(unitId) {
  const { data } = await supabase.from('units').select('regua').eq('id', unitId).maybeSingle();
  return mesclarRegua(data?.regua);
}

function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + dias);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(d));
}

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';

export function nomesAlunos(lista) {
  const nomes = [...new Set((lista || []).map((n) => primeiroNome(n)).filter(Boolean))];
  if (nomes.length <= 2) return nomes.join(' e ');
  return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
}

export function preencher(texto, vars) {
  return String(texto || '').replace(/\{(responsavel|aluno|valor|vencimento)\}/g, (_, k) => (vars[k] ?? ''));
}

export function preencherDemo(texto) {
  return preencher(texto, { responsavel: 'Maria', aluno: 'João', valor: 'R$ 150,00', vencimento: dataBr(hojeSP()) });
}

async function temBoletoAtivo(unitId, codPars) {
  if (!codPars.length) return false;
  const { data } = await supabase.from('cobrancas_asaas').select('id')
    .eq('unit_id', unitId).in('status', ['pendente', 'recebido']).overlaps('cod_pars', codPars).limit(1);
  return !!(data && data.length);
}

/** Envia (ou pula) um grupo já montado. Retorna 'enviado' | 'simulado' | 'pulado' | 'erro'. */
async function enviarGrupo(unitId, g, origem) {
  const { data: jaExiste } = await supabase.from('regua_envios').select('id').eq('unit_id', unitId).eq('chave', g.chave).maybeSingle();
  if (jaExiste) return 'pulado';

  const base = {
    unit_id: unitId, chave: g.chave, offset_dias: g.passo.offset, vencimento: g.vencimento || null,
    telefone: digitos(g.telefone), cod_pars: g.cod_pars, alunos: g.alunosTxt, valor_centavos: g.valor, origem
  };

  if (await temBoletoAtivo(unitId, g.cod_pars)) {
    await supabase.from('regua_envios').insert({ ...base, status: 'pulado_boleto_ativo' }).then(() => {}, () => {});
    return 'pulado';
  }

  const texto = preencher(g.passo.texto, {
    responsavel: primeiroNome(g.responsavel) || 'tudo bem',
    aluno: g.alunosTxt, valor: reais(g.valor), vencimento: dataBr(g.vencimento)
  });
  const env = await enviarWhatsapp(unitId, g.telefone, texto, { conversaId: null });
  if (env.ok || env.status === 'simulado') {
    await supabase.from('regua_envios').insert({ ...base, status: env.status === 'simulado' ? 'simulado' : 'enviado' }).then(() => {}, () => {});
    return env.status === 'simulado' ? 'simulado' : 'enviado';
  }
  await registrar('regua', 'envio_erro', false, { unitId, detalhe: { chave: g.chave, erro: env.erro } });
  return 'erro';
}

function contabilizar(resumo, r) {
  if (r === 'enviado' || r === 'simulado') resumo.enviados++;
  else if (r === 'pulado') resumo.pulados++;
  else resumo.erros++;
}

/** Disparo AUTOMÁTICO de uma unidade: parcelas vencendo nos prazos ativos, nos status escolhidos. */
export async function processarReguaUnidade(unitId, { forcar = false, limite = 400 } = {}) {
  const regua = await reguaDaUnidade(unitId);
  const resumo = { unit_id: unitId, grupos: 0, enviados: 0, pulados: 0, erros: 0 };
  if (!regua.ativa && !forcar) return { ...resumo, pulou: 'inativa' };
  const passos = regua.passos.filter((p) => p.ativo);
  if (!passos.length) return { ...resumo, pulou: 'sem_passos' };

  const hoje = hojeSP();
  const porData = new Map(passos.map((p) => [somaDias(hoje, -p.offset), p]));

  let carteira;
  try {
    carteira = await ponte(unitId, 'carteira', { datas: [...porData.keys()], statuses: regua.statuses }, { timeoutMs: 40000 });
  } catch (e) {
    await registrar('regua', 'carteira_erro', false, { unitId, detalhe: { erro: e.message } });
    return { ...resumo, erros: 1, erro: e.codigo || e.message };
  }
  carteira = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);

  const grupos = new Map();
  for (const p of carteira) {
    const passo = porData.get(p.vencimento);
    if (!passo) continue;
    const tel = digitos(p.telefone);
    const chave = `${passo.offset}|${p.vencimento}|${tel}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, passo, telefone: p.telefone, vencimento: p.vencimento, responsavel: p.nome_responsavel || '', _alunos: [], cod_pars: [], valor: 0 });
    const g = grupos.get(chave);
    g._alunos.push(p.nome_aluno); g.cod_pars.push(p.cod_par); g.valor += Number(p.valor || 0);
    if (!g.responsavel && p.nome_responsavel) g.responsavel = p.nome_responsavel;
  }
  resumo.grupos = grupos.size;

  let feitos = 0;
  for (const g of grupos.values()) {
    if (feitos >= limite) break;
    feitos++;
    g.alunosTxt = nomesAlunos(g._alunos);
    contabilizar(resumo, await enviarGrupo(unitId, g, 'auto'));
  }
  await registrar('regua', 'disparo', resumo.erros === 0, { unitId, detalhe: resumo });
  return resumo;
}

/** Prévia do disparo MANUAL: quantos responsáveis/parcelas entram, sem enviar nada. */
export async function previaManual(unitId, { de, ate, statuses }) {
  const carteira = await ponte(unitId, 'carteira', { de, ate, statuses }, { timeoutMs: 40000 });
  const comTel = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);
  const tels = new Set(comTel.map((p) => digitos(p.telefone)));
  return {
    responsaveis: tels.size,
    parcelas: comTel.length,
    sem_telefone: (carteira || []).length - comTel.length,
    valor_total: comTel.reduce((s, p) => s + Number(p.valor || 0), 0)
  };
}

/** Disparo MANUAL: envia a mensagem escolhida a quem tem parcela no período e status escolhidos. */
export async function dispararManual(unitId, { de, ate, statuses, offset, limite = 600 }) {
  const regua = await reguaDaUnidade(unitId);
  const passo = regua.passos.find((p) => Number(p.offset) === Number(offset)) || regua.passos[0];
  const carteira = await ponte(unitId, 'carteira', { de, ate, statuses }, { timeoutMs: 40000 });
  const lista = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);

  // Uma mensagem por responsável (agrupa todas as parcelas da pessoa no período)
  const grupos = new Map();
  for (const p of lista) {
    const tel = digitos(p.telefone);
    const chave = `M|${tel}|${passo.offset}|${de}|${ate}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, passo, telefone: p.telefone, vencimento: p.vencimento, responsavel: p.nome_responsavel || '', _alunos: [], cod_pars: [], valor: 0 });
    const g = grupos.get(chave);
    g._alunos.push(p.nome_aluno); g.cod_pars.push(p.cod_par); g.valor += Number(p.valor || 0);
    if (p.vencimento && (!g.vencimento || p.vencimento < g.vencimento)) g.vencimento = p.vencimento;
    if (!g.responsavel && p.nome_responsavel) g.responsavel = p.nome_responsavel;
  }

  const resumo = { unit_id: unitId, grupos: grupos.size, enviados: 0, pulados: 0, erros: 0 };
  let feitos = 0;
  for (const g of grupos.values()) {
    if (feitos >= limite) break;
    feitos++;
    g.alunosTxt = nomesAlunos(g._alunos);
    contabilizar(resumo, await enviarGrupo(unitId, g, 'manual'));
  }
  await registrar('regua', 'manual', resumo.erros === 0, { unitId, detalhe: { ...resumo, de, ate, statuses, offset: passo.offset } });
  return resumo;
}
