import { supabase, CFG, reais, dataBr, hojeSP, digitos, registrar } from './base.js';
import { ponte } from './ponte.js';
import { enviarWhatsapp } from './gateway.js';

/**
 * Régua de cobrança (disparo automático de mensagens no WhatsApp).
 * Cada unidade tem a sua régua; quando `regua` é null na unidade, vale este padrão de fábrica.
 * Variáveis dos textos: {responsavel} {aluno} {valor} {vencimento}
 */
export const REGUA_PADRAO = {
  ativa: false, // a unidade liga quando o WhatsApp estiver conectado
  horario: 9, // hora local (America/Sao_Paulo) em que os disparos saem
  pula_domingo: true,
  passos: [
    {
      offset: -3,
      ativo: true,
      texto:
        'Oi, {responsavel}! 😊 Passando pra lembrar que a mensalidade de {aluno} ({valor}) vence em {vencimento}. Pagando até o vencimento você garante o desconto de pontualidade. Se quiser o boleto ou o Pix, é só responder aqui que eu te mando!'
    },
    {
      offset: 0,
      ativo: true,
      texto:
        'Olá, {responsavel}! A mensalidade de {aluno} ({valor}) vence hoje ({vencimento}). Dá pra pagar por boleto ou Pix — me responde aqui que eu envio na hora. 😉'
    },
    {
      offset: 1,
      ativo: true,
      texto:
        'Oi, {responsavel}! Vi que a mensalidade de {aluno}, com vencimento em {vencimento}, ficou em aberto. Acontece! Quer que eu gere a segunda via por boleto ou Pix (já com o valor atualizado)? É só responder aqui. 🙂'
    },
    {
      offset: 7,
      ativo: true,
      texto:
        'Olá, {responsavel}! A mensalidade de {aluno} venceu em {vencimento} e segue em aberto. Posso te enviar o boleto já com o valor atualizado ou o Pix agora mesmo — responde aqui que a gente resolve juntos. 😊'
    },
    {
      offset: 15,
      ativo: true,
      texto:
        'Oi, {responsavel}. A mensalidade de {aluno} está vencida desde {vencimento}. Pra evitar que o débito aumente, vamos resolver? Me responde aqui que eu te mando o boleto atualizado ou o Pix, ou combino um prazo com você.'
    },
    {
      offset: 30,
      ativo: true,
      texto:
        'Olá, {responsavel}. A mensalidade de {aluno} está em aberto há cerca de 30 dias (desde {vencimento}). Precisamos regularizar para manter a matrícula em dia. Me responde aqui hoje que eu te ajudo com o pagamento ou com um acordo. 🙏'
    }
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
  return {
    ativa: salva.ativa === true,
    horario: Number.isInteger(salva.horario) ? Math.min(23, Math.max(0, salva.horario)) : base.horario,
    pula_domingo: salva.pula_domingo !== false,
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

/** Texto de exemplo para o botão "enviar teste". */
export function preencherDemo(texto) {
  return preencher(texto, { responsavel: 'Maria', aluno: 'João', valor: 'R$ 150,00', vencimento: dataBr(hojeSP()) });
}

async function temBoletoAtivo(unitId, codPars) {
  if (!codPars.length) return false;
  const { data } = await supabase
    .from('cobrancas_asaas')
    .select('id')
    .eq('unit_id', unitId)
    .in('status', ['pendente', 'recebido'])
    .overlaps('cod_pars', codPars)
    .limit(1);
  return !!(data && data.length);
}

/**
 * Processa a régua de UMA unidade: varre a carteira, agrupa por responsável+passo,
 * não repete (dedup), pula quem já tem boleto ativo, e envia pelo WhatsApp.
 */
export async function processarReguaUnidade(unitId, { forcar = false, limite = 400 } = {}) {
  const regua = await reguaDaUnidade(unitId);
  const resumo = { unit_id: unitId, grupos: 0, enviados: 0, pulados: 0, erros: 0 };
  if (!regua.ativa && !forcar) return { ...resumo, pulou: 'inativa' };
  const passos = regua.passos.filter((p) => p.ativo);
  if (!passos.length) return { ...resumo, pulou: 'sem_passos' };

  const hoje = hojeSP();
  // passo com offset o  →  mensagem hoje para parcelas cujo vencimento = hoje - o
  const porData = new Map(passos.map((p) => [somaDias(hoje, -p.offset), p]));
  const datas = [...porData.keys()];

  let carteira;
  try {
    carteira = await ponte(unitId, 'carteira', { datas }, { timeoutMs: 40000 });
  } catch (e) {
    await registrar('regua', 'carteira_erro', false, { unitId, detalhe: { erro: e.message } });
    return { ...resumo, erros: 1, erro: e.codigo || e.message };
  }
  carteira = (carteira || []).filter((p) => p.telefone && digitos(p.telefone).length >= 10);

  // Agrupa por (telefone, passo/vencimento): uma mensagem por responsável por passo
  const grupos = new Map();
  for (const p of carteira) {
    const passo = porData.get(p.vencimento);
    if (!passo) continue;
    const chave = `${passo.offset}|${p.vencimento}|${digitos(p.telefone)}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, passo, telefone: p.telefone, vencimento: p.vencimento, responsavel: p.nome_responsavel || '', alunos: [], cod_pars: [], valor: 0 });
    }
    const g = grupos.get(chave);
    g.alunos.push(p.nome_aluno);
    g.cod_pars.push(p.cod_par);
    g.valor += Number(p.valor || 0);
    if (!g.responsavel && p.nome_responsavel) g.responsavel = p.nome_responsavel;
  }
  resumo.grupos = grupos.size;

  let feitos = 0;
  for (const g of grupos.values()) {
    if (feitos >= limite) break;

    const { data: jaExiste } = await supabase.from('regua_envios').select('id').eq('unit_id', unitId).eq('chave', g.chave).maybeSingle();
    if (jaExiste) { resumo.pulados++; continue; }

    const alunosTxt = nomesAlunos(g.alunos);

    if (await temBoletoAtivo(unitId, g.cod_pars)) {
      resumo.pulados++;
      await supabase.from('regua_envios').insert({
        unit_id: unitId, chave: g.chave, offset_dias: g.passo.offset, vencimento: g.vencimento,
        telefone: digitos(g.telefone), cod_pars: g.cod_pars, alunos: alunosTxt, valor_centavos: g.valor, status: 'pulado_boleto_ativo'
      }).then(() => {}, () => {});
      continue;
    }

    const texto = preencher(g.passo.texto, {
      responsavel: primeiroNome(g.responsavel) || 'tudo bem',
      aluno: alunosTxt,
      valor: reais(g.valor),
      vencimento: dataBr(g.vencimento)
    });

    feitos++;
    const env = await enviarWhatsapp(unitId, g.telefone, texto, { conversaId: null });
    if (env.ok || env.status === 'simulado') {
      resumo.enviados++;
      await supabase.from('regua_envios').insert({
        unit_id: unitId, chave: g.chave, offset_dias: g.passo.offset, vencimento: g.vencimento,
        telefone: digitos(g.telefone), cod_pars: g.cod_pars, alunos: alunosTxt, valor_centavos: g.valor,
        status: env.status === 'simulado' ? 'simulado' : 'enviado'
      }).then(() => {}, () => {});
    } else {
      // Não grava dedup em falha de envio: permite nova tentativa no próximo disparo.
      resumo.erros++;
      await registrar('regua', 'envio_erro', false, { unitId, detalhe: { chave: g.chave, erro: env.erro } });
    }
  }

  await registrar('regua', 'disparo', resumo.erros === 0, { unitId, detalhe: resumo });
  return resumo;
}
