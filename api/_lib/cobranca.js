import { supabase, reais, dataBr, hojeSP, cpfValido, digitos } from './base.js';
import { ponte } from './ponte.js';
import { garantirCliente, criarCobranca, detalhesPagamento } from './asaas.js';
import { simulando } from './contexto.js';
import { atualizarConversa } from './conversa.js';

const GRACA_DIAS = 3; // vencimento do boleto de parcela já vencida: hoje + 3 dias
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.replace(/^./, (c) => c.toUpperCase()) || '';

function somaDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + dias);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}

/** Documento (carnê) escolhido entre os em aberto, por vencimento, ou o mais antigo vencido / próximo. */
function escolherDocumento(documentos, vencimentoBr, hoje) {
  if (vencimentoBr) {
    const iso = String(vencimentoBr).includes('/') ? vencimentoBr.split('/').reverse().join('-') : vencimentoBr;
    const d = documentos.find((x) => x.vencimento === iso);
    if (d) return d;
    return null;
  }
  const vencidos = documentos.filter((d) => d.vencimento < hoje);
  if (vencidos.length) return vencidos[0]; // mais antigo (documentos vêm ordenados)
  return documentos.find((d) => d.vencimento >= hoje) || null;
}

/** Procura cobrança ativa (não paga/cancelada) que já cubra alguma destas parcelas. */
async function cobrancaAtiva(unitId, codPars) {
  const { data } = await supabase
    .from('cobrancas_asaas')
    .select('*')
    .eq('unit_id', unitId)
    .in('status', ['pendente', 'recebido'])
    .overlaps('cod_pars', codPars)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

/**
 * Passo 1 (sem efeito): valida identidade/CPF, escolhe a parcela, calcula o valor pela ponte
 * e guarda a prévia na conversa. Retorna o que o agente deve CONFIRMAR com o aluno.
 */
export async function prepararCobranca({ conversa, codAlu, vencimentoBr }) {
  if (!conversa.identidade_confirmada) return { erro: 'identidade_nao_confirmada' };
  const noGrupo = (conversa.cod_alus || []).includes(String(codAlu));
  if (!noGrupo) return { erro: 'aluno_fora_do_grupo' };

  const aluno = await ponte(conversa.unit_id, 'aluno', { cod_alu: String(codAlu) }, { conversaId: conversa.id });
  const cpf = aluno.cpf_responsavel || aluno.cpf_aluno;
  const nomeResp = aluno.nome_responsavel || aluno.nome;
  if (!cpfValido(cpf)) {
    return { erro: 'erro_cpf', nome_responsavel: nomeResp, mensagem: 'CPF do responsável ausente ou inválido no cadastro.' };
  }

  const hoje = hojeSP();
  const abertas = await ponte(conversa.unit_id, 'parcelas', { cod_alus: [String(codAlu)], data_referencia: hoje }, { conversaId: conversa.id });
  const doc = escolherDocumento(abertas.documentos, vencimentoBr, hoje);
  if (!doc) return { erro: 'parcela_nao_encontrada' };

  const vencido = doc.vencimento < hoje;
  const dueDate = vencido ? somaDias(hoje, GRACA_DIAS) : doc.vencimento;
  // Valor fechado (opção A): o que a ponte calcula para a data de vencimento do boleto.
  let valor;
  if (vencido) {
    const naData = await ponte(conversa.unit_id, 'parcelas', { cod_alus: [String(codAlu)], data_referencia: dueDate }, { conversaId: conversa.id });
    const docNaData = naData.documentos.find((d) => JSON.stringify([...d.cod_pars].sort()) === JSON.stringify([...doc.cod_pars].sort()));
    if (!docNaData) return { erro: 'parcela_nao_encontrada' };
    valor = docNaData.valor_devido;
  } else {
    valor = doc.valor_em_dia; // paga até o vencimento: já com o desconto de pontualidade
  }
  if (!valor || valor <= 0) return { erro: 'valor_invalido' };

  const existente = await cobrancaAtiva(conversa.unit_id, doc.cod_pars);

  const preparada = {
    cod_alu: String(codAlu),
    nome_aluno: aluno.nome,
    cod_pars: doc.cod_pars,
    vencimento_parcela: doc.vencimento,
    due_date: dueDate,
    valor_centavos: valor,
    cpf_responsavel: digitos(cpf),
    nome_responsavel: nomeResp,
    telefone: aluno.whatsapp_responsavel || aluno.whatsapp || conversa.telefone,
    email: aluno.email || null,
    vencido,
    criado_em: new Date().toISOString(),
    ja_existe: existente ? existente.id : null
  };
  conversa = await atualizarConversa(conversa.id, { contexto: { ...(conversa.contexto || {}), cobranca_preparada: preparada } });

  return {
    nome_responsavel: nomeResp,
    nome_aluno: primeiroNome(aluno.nome),
    vencimento_parcela: dataBr(doc.vencimento),
    vencimento_boleto: dataBr(dueDate),
    valor: reais(valor),
    vencida: vencido,
    ja_tem_boleto: !!existente
  };
}

/**
 * Passo 2 (cria a cobrança no Asaas e devolve o boleto). Recalcula o valor e confere
 * contra o que foi preparado/confirmado; recusa se mudou. Nunca duplica.
 */
export async function emitirCobranca({ conversa, segredos, via = 'whatsapp' }) {
  const p = conversa.contexto?.cobranca_preparada;
  if (!p) return { erro: 'prepare_primeiro' };
  if (Date.now() - new Date(p.criado_em).getTime() > 15 * 60 * 1000) return { erro: 'prepare_primeiro', mensagem: 'A prévia expirou. Consulte de novo.' };

  // Reconfere o valor na ponte (nada muda o dinheiro entre confirmar e emitir)
  const atual = await ponte(conversa.unit_id, 'parcelas', { cod_alus: [p.cod_alu], data_referencia: p.due_date }, { conversaId: conversa.id });
  const doc = atual.documentos.find((d) => JSON.stringify([...d.cod_pars].sort()) === JSON.stringify([...p.cod_pars].sort()));
  if (!doc) return { erro: 'parcela_mudou', mensagem: 'As parcelas mudaram. Consulte de novo.' };
  if (Math.abs(doc.valor_devido - p.valor_centavos) > 1) {
    return { erro: 'valor_mudou', valor_novo: reais(doc.valor_devido) };
  }

  // Já existe cobrança ativa para essas parcelas? Reenvia a mesma.
  const existente = await cobrancaAtiva(conversa.unit_id, p.cod_pars);
  if (existente) {
    return {
      reenvio: true, valor: reais(existente.valor_centavos), vencimento: dataBr(existente.vencimento),
      boleto_url: existente.boleto_url, pix_copia_cola: existente.pix_copia_cola, linha_digitavel: existente.linha_digitavel
    };
  }

  if (simulando()) {
    return { simulado: true, valor: reais(p.valor_centavos), vencimento: dataBr(p.due_date), nome_responsavel: p.nome_responsavel };
  }

  if (!segredos.asaas) return { erro: 'asaas_nao_configurado' };
  const externalReference = `${conversa.unit_id}|${[...p.cod_pars].sort((a, b) => a - b).join('-')}|${p.due_date}`;

  const customer = await garantirCliente(segredos.asaas, {
    nome: p.nome_responsavel, cpf: p.cpf_responsavel, telefone: p.telefone, email: p.email, unitId: conversa.unit_id
  });
  const descricao = `MULT Profissões - ${p.nome_aluno} - parcela(s) ${p.cod_pars.join('/')} venc. ${dataBr(p.vencimento_parcela)}`;
  const pay = await criarCobranca(segredos.asaas, {
    customer, valorCentavos: p.valor_centavos, vencimento: p.due_date, descricao, externalReference, unitId: conversa.unit_id
  });
  const det = await detalhesPagamento(segredos.asaas, pay.id, conversa.unit_id);

  const { data: linha } = await supabase.from('cobrancas_asaas').insert({
    unit_id: conversa.unit_id, conversa_id: conversa.id, cod_alu: p.cod_alu, nome_aluno: p.nome_aluno,
    cod_pars: p.cod_pars, vencimento: p.due_date, valor_centavos: p.valor_centavos,
    cpf_responsavel: p.cpf_responsavel, nome_responsavel: p.nome_responsavel,
    asaas_customer_id: customer, asaas_payment_id: pay.id, external_reference: externalReference,
    status: 'pendente', boleto_url: pay.invoiceUrl || pay.bankSlipUrl || null,
    pix_copia_cola: det.pix_copia_cola, linha_digitavel: det.linha_digitavel, criado_por: via === 'painel' ? 'master' : 'ia'
  }).select('*').single();

  // Registra a ocorrência no sistema escolar (boleto emitido)
  const origemTxt = via === 'painel' ? 'PAINEL ADMIN (TESTE)' : 'WHATSAPP';
  await ponte(conversa.unit_id, 'registrar_ocorrencia', {
    cod_alu: p.cod_alu,
    texto: `BOLETO ASAAS EMITIDO VIA ${origemTxt}: ${reais(p.valor_centavos)}, venc. ${dataBr(p.due_date)}, parcela(s) ${p.cod_pars.join('/')}. Pagamento por boleto ou Pix.`,
    chave: `oco-boleto-${linha?.id || externalReference}`
  }, { conversaId: conversa.id }).catch(() => null);

  await atualizarConversa(conversa.id, { contexto: { ...(conversa.contexto || {}), cobranca_preparada: null } });
  return {
    emitido: true, valor: reais(p.valor_centavos), vencimento: dataBr(p.due_date),
    boleto_url: pay.invoiceUrl || pay.bankSlipUrl, pix_copia_cola: det.pix_copia_cola, linha_digitavel: det.linha_digitavel
  };
}
