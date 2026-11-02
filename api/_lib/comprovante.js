import crypto from 'crypto';
import { supabase, CFG, reais, dataBr, digitos, hojeSP } from './base.js';
import { ponte, ErroPonte } from './ponte.js';
import { lerArquivoJson } from './ia.js';
import { procurarPixRecebido } from './asaas.js';
import { responder, chamarHumano, atualizarConversa } from './conversa.js';

const INSTRUCAO = `Você recebe um arquivo enviado por WhatsApp a uma escola. Diga se é um COMPROVANTE DE PAGAMENTO
(Pix, transferência, boleto pago, recibo bancário) e extraia os dados. Responda APENAS com JSON:
{
  "e_comprovante": true|false,
  "tipo": "pix"|"ted"|"boleto"|"deposito"|"outro",
  "valor": número em reais (ex.: 180.00) ou null,
  "data": "AAAA-MM-DD" da efetivação ou null,
  "hora": "HH:MM" ou null,
  "end_to_end_id": código fim-a-fim do Pix (começa com E e tem 32 caracteres) ou null,
  "pagador_nome": string ou null,
  "pagador_documento": CPF/CNPJ (mesmo parcial) ou null,
  "recebedor_nome": string ou null,
  "recebedor_documento": CPF/CNPJ do recebedor (mesmo parcial) ou null,
  "recebedor_chave": chave Pix do recebedor ou null,
  "banco_pagador": string ou null,
  "agendamento": true se for só um agendamento (não pago ainda),
  "legivel": true|false,
  "observacao": curto, em português
}
Não invente: use null quando não estiver no arquivo.`;

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';

/** Grupo (responsável + alunos) da conversa: confirmado, ou único pelo telefone. */
export async function grupoDaConversa(conversa) {
  if (conversa.identidade_confirmada && conversa.cod_alus?.length) {
    return { confirmado: true, cod_alus: conversa.cod_alus, alunos: conversa.contexto?.grupo?.alunos || [] };
  }
  let grupos = conversa.contexto?.candidatos;
  if (!grupos) {
    grupos = await ponte(conversa.unit_id, 'buscar_telefone', { telefone: conversa.telefone }, { conversaId: conversa.id }).catch(() => []);
    await atualizarConversa(conversa.id, { contexto: { ...(conversa.contexto || {}), candidatos: grupos, candidatos_em: new Date().toISOString() } });
  }
  if (grupos.length === 1) {
    return { confirmado: false, cod_alus: grupos[0].alunos.map((a) => a.cod_alu), alunos: grupos[0].alunos };
  }
  return null;
}

async function baixarArquivo(path) {
  const { data, error } = await supabase.storage.from(CFG.bucket).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

/** Novo arquivo recebido: cria o comprovante e processa. */
export async function receberArquivo({ conversa, unidade, segredos, payload, mensagem }) {
  if (payload.mediaTooLarge || payload.mediaError || !payload.mediaPath) {
    await responder(conversa, 'Não consegui abrir o arquivo que você enviou. Pode mandar de novo, de preferência como foto ou PDF? 🙏');
    return;
  }
  const mime = payload.mediaMimeType || '';
  if (!/^image\/|application\/pdf/.test(mime)) {
    await chamarHumano(conversa, `Arquivo recebido (${payload.mediaFileName || mime}) que não é imagem nem PDF.`);
    await responder(conversa, 'Recebi seu arquivo. Vou passar para a nossa equipe da secretaria dar uma olhada, tudo bem?');
    return;
  }
  const buffer = await baixarArquivo(payload.mediaPath);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  const { data: repetido } = await supabase
    .from('comprovantes').select('id, recebido_em, status')
    .eq('unit_id', conversa.unit_id).eq('hash_arquivo', hash)
    .not('status', 'in', '(rejeitado,nao_e_comprovante)')
    .limit(1).maybeSingle();

  const { data: comp } = await supabase.from('comprovantes').insert({
    unit_id: conversa.unit_id,
    conversa_id: conversa.id,
    mensagem_id: mensagem?.id || null,
    telefone: conversa.telefone,
    remetente_nome: conversa.nome_contato || payload.senderName || null,
    arquivo_path: payload.mediaPath,
    arquivo_nome: payload.mediaFileName || payload.mediaPath.split('/').pop(),
    mime,
    hash_arquivo: hash,
    status: repetido ? 'duplicado' : 'analisando',
    observacao: repetido ? `Mesmo arquivo já recebido em ${new Date(repetido.recebido_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : null
  }).select('*').single();

  if (repetido) {
    await responder(conversa, `Esse comprovante já tinha chegado aqui em ${new Date(repetido.recebido_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} e está registrado. 👍 Se for outro pagamento, me envie o comprovante novo.`);
    return;
  }

  let ext;
  try {
    ext = await lerArquivoJson({ base64: buffer.toString('base64'), mime, instrucao: INSTRUCAO, chave: segredos.gemini, unitId: conversa.unit_id, conversaId: conversa.id });
  } catch (e) {
    await supabase.from('comprovantes').update({ status: 'aguardando_humano', observacao: 'Falha na leitura automática: ' + e.message }).eq('id', comp.id);
    await chamarHumano(conversa, 'Comprovante recebido, mas a leitura automática falhou.', { comprovanteId: comp.id, tipo: 'comprovante' });
    await responder(conversa, 'Recebi seu comprovante! Nossa equipe vai conferir e registrar. Qualquer coisa te aviso por aqui. 😊');
    return;
  }

  if (!ext?.e_comprovante) {
    await supabase.from('comprovantes').update({ status: 'nao_e_comprovante', extraido: ext }).eq('id', comp.id);
    await chamarHumano(conversa, `Arquivo recebido que não parece comprovante: ${ext?.observacao || ''}`);
    await responder(conversa, 'Recebi seu arquivo. Vou encaminhar para a secretaria, que já te responde por aqui.');
    return;
  }

  const valor = ext.valor != null ? Math.round(Number(ext.valor) * 100) : null;
  const e2e = /^E[0-9A-Za-z]{31}$/.test(String(ext.end_to_end_id || '').trim()) ? String(ext.end_to_end_id).trim() : null;
  await supabase.from('comprovantes').update({
    extraido: ext, valor_centavos: valor, data_pagamento: /^\d{4}-\d{2}-\d{2}$/.test(ext.data || '') ? ext.data : null, end_to_end_id: e2e
  }).eq('id', comp.id);

  if (e2e) {
    const { data: mesmoE2e } = await supabase.from('comprovantes').select('id, recebido_em')
      .eq('unit_id', conversa.unit_id).eq('end_to_end_id', e2e).neq('id', comp.id)
      .not('status', 'in', '(rejeitado,nao_e_comprovante,duplicado)').limit(1).maybeSingle();
    if (mesmoE2e) {
      await supabase.from('comprovantes').update({ status: 'duplicado', end_to_end_id: null, observacao: `Mesmo Pix (E2E ${e2e}) já recebido.` }).eq('id', comp.id);
      await responder(conversa, 'Esse pagamento já tinha sido enviado e está registrado aqui. 👍 Se for outro pagamento, me envie o comprovante dele.');
      return;
    }
  }

  await processarComprovante(comp.id, { unidade, segredos, conversa });
}

/**
 * Concilia e decide: baixa automática (se liberada e o Pix estiver no extrato),
 * modo sombra (registra e deixa a sugestão para a secretaria) ou conferência humana.
 */
export async function processarComprovante(comprovanteId, { unidade, segredos, conversa }) {
  const { data: comp } = await supabase.from('comprovantes').select('*').eq('id', comprovanteId).single();
  const ext = comp.extraido || {};
  const valor = comp.valor_centavos;
  const dataPag = comp.data_pagamento;

  const pendente = async (status, motivo, msgAluno, extra = {}) => {
    await supabase.from('comprovantes').update({ status, observacao: motivo, ...extra }).eq('id', comp.id);
    await chamarHumano(conversa, `Comprovante ${valor ? reais(valor) : ''}: ${motivo}`, { comprovanteId: comp.id, tipo: 'comprovante' });
    if (msgAluno) await responder(conversa, msgAluno);
  };

  if (ext.agendamento) {
    return pendente('aguardando_humano', 'Comprovante de AGENDAMENTO (pagamento ainda não efetivado).',
      'Recebi! Vi que é um agendamento de pagamento. Assim que ele for efetivado, pode me mandar o comprovante final? 😊');
  }
  if (!valor || !dataPag || ext.legivel === false) {
    return pendente('aguardando_humano', 'Não foi possível ler valor/data com segurança.',
      'Recebi seu comprovante! Nossa equipe vai conferir e registrar. Qualquer coisa te aviso por aqui. 😊');
  }
  if (dataPag > hojeSP()) {
    return pendente('divergente', `Data do comprovante no futuro (${dataBr(dataPag)}).`, 'Recebi seu comprovante! Nossa equipe vai conferir e registrar.');
  }

  // Recebedor: precisa ser a MULT (CNPJ ou nome da conta)
  const docRec = digitos(ext.recebedor_documento) + ' ' + digitos(ext.recebedor_chave);
  const cnpj = digitos(unidade.recebedor_documento);
  const nomeRec = String(ext.recebedor_nome || '').toUpperCase();
  const parteCnpj = cnpj ? cnpj.slice(0, 8) : '';
  const recebedorOk = !!cnpj && (docRec.includes(cnpj) || (parteCnpj && docRec.includes(parteCnpj)) ||
    (unidade.recebedor_nome && nomeRec.includes(String(unidade.recebedor_nome).toUpperCase().split(' ').slice(0, 2).join(' '))));
  await supabase.from('comprovantes').update({ recebedor_ok: recebedorOk }).eq('id', comp.id);
  if (!recebedorOk) {
    return pendente('divergente', `Recebedor não confere (${ext.recebedor_nome || '?'} ${ext.recebedor_documento || ''}).`,
      'Recebi seu comprovante! Nossa equipe vai conferir os dados do pagamento e já te retorna por aqui.');
  }

  // Quem pagou: grupo da conversa
  const grupo = await grupoDaConversa(conversa);
  if (!grupo) {
    await supabase.from('comprovantes').update({ status: 'aguardando_aluno', observacao: 'Aguardando identificação do aluno.' }).eq('id', comp.id);
    const ctx = { ...(conversa.contexto || {}), comprovantes_pendentes: [...new Set([...(conversa.contexto?.comprovantes_pendentes || []), comp.id])] };
    await atualizarConversa(conversa.id, { contexto: ctx });
    await responder(conversa, `Recebi seu comprovante de ${reais(valor)}. 😊 Para eu registrar no lugar certo, me informe por favor o CPF do responsável financeiro (ou do aluno).`);
    return;
  }

  // Conciliação com as parcelas em aberto
  let conc;
  try {
    conc = await ponte(conversa.unit_id, 'conciliar', { cod_alus: grupo.cod_alus, valor_pago: valor, data_pagamento: dataPag }, { conversaId: conversa.id });
  } catch (e) {
    return pendente('aguardando_humano', `Erro ao consultar parcelas: ${e.message}`, 'Recebi seu comprovante! Nossa equipe vai registrar e te confirma por aqui.');
  }
  await supabase.from('comprovantes').update({ cod_alus: grupo.cod_alus }).eq('id', comp.id);
  if (conc.status !== 'exato') {
    const motivo = conc.status === 'ambiguo'
      ? `Valor ${reais(valor)} bate com mais de uma combinação de parcelas.`
      : `Valor ${reais(valor)} em ${dataBr(dataPag)} não bate com as parcelas em aberto.`;
    return pendente('divergente', motivo, `Recebi seu comprovante de ${reais(valor)}. Vou pedir para a secretaria conferir em quais parcelas ele entra e te confirmo por aqui. 👍`);
  }
  const docs = conc.documentos;
  const codPars = docs.flatMap((d) => d.cod_pars);
  const descricao = docs.map((d) => {
    const al = grupo.alunos.find((a) => a.cod_alu === d.cod_alu);
    return `${primeiroNome(al?.nome)} (venc. ${dataBr(d.vencimento)})`;
  }).join(', ');
  await supabase.from('comprovantes').update({ cod_pars: codPars }).eq('id', comp.id);

  // Conferência no extrato do Asaas
  let extrato = { status: 'sem_asaas' };
  if (segredos.asaas) {
    try {
      const { data: usados } = await supabase.from('comprovantes').select('extrato_ref')
        .eq('unit_id', conversa.unit_id).not('extrato_ref', 'is', null);
      extrato = await procurarPixRecebido(segredos.asaas, {
        valorCentavos: valor, data: dataPag, endToEndId: comp.end_to_end_id,
        ignorarIds: (usados || []).map((u) => u.extrato_ref), unitId: conversa.unit_id
      });
    } catch (e) {
      extrato = { status: 'erro', erro: e.message };
    }
  }
  const conferido = extrato.status === 'encontrado';
  await supabase.from('comprovantes').update({
    extrato_conferido: conferido, extrato_ref: conferido ? extrato.transacao.id : null
  }).eq('id', comp.id);

  const detalhe = `Comprovante WhatsApp ${comp.arquivo_nome || ''}${comp.end_to_end_id ? ' E2E ' + comp.end_to_end_id : ''}${conferido ? ' - Pix conferido no extrato Asaas' : ''}.`;

  // Baixa automática: só com o Pix localizado pelo código E2E (valor e data podem coincidir
  // com o Pix de outra pessoa) e unidade liberada
  const conferidoPorE2e = conferido && !!comp.end_to_end_id && extrato.transacao?.e2e === comp.end_to_end_id;
  if (conferidoPorE2e && unidade.baixa_automatica) {
    try {
      const r = await ponte(conversa.unit_id, 'baixar', {
        cod_pars: codPars, valor_pago: valor, data_pagamento: dataPag, chave: `comp-${comp.id}`, origem: 'whatsapp', detalhe
      }, { conversaId: conversa.id, timeoutMs: 30000 });
      await supabase.from('comprovantes').update({ status: 'baixado', ponte_resultado: r, observacao: `Baixa automática: ${descricao}` }).eq('id', comp.id);
      await responder(conversa, `Pagamento de ${reais(valor)} confirmado e registrado ✅\nReferente a: ${descricao}.\nObrigado! 😊`);
      return;
    } catch (e) {
      if (!(e instanceof ErroPonte) || e.codigo !== 'baixa_desligada') {
        return pendente('aguardando_humano', `Baixa automática recusada: ${e.codigo || ''} ${e.message}`,
          `Recebi seu comprovante de ${reais(valor)}! A secretaria vai concluir o registro e te confirma por aqui. 👍`);
      }
      // ponte em modo sombra: segue como sombra
    }
  }

  // Modo sombra / sem confirmação no extrato: simula, anota ocorrência e deixa a sugestão
  let sim = null;
  try {
    sim = await ponte(conversa.unit_id, 'simular_baixa', { cod_pars: codPars, valor_pago: valor, data_pagamento: dataPag }, { conversaId: conversa.id });
  } catch (e) {
    sim = { erro: e.codigo, mensagem: e.message };
  }
  const alunosOco = [...new Set(docs.map((d) => d.cod_alu))];
  for (const codAlu of alunosOco) {
    await ponte(conversa.unit_id, 'registrar_ocorrencia', {
      cod_alu: codAlu,
      texto: `COMPROVANTE RECEBIDO VIA WHATSAPP: ${ext.tipo?.toUpperCase() || 'PAGAMENTO'} de ${reais(valor)} em ${dataBr(dataPag)} (arquivo ${comp.arquivo_nome || ''}). Parcela(s) ${codPars.join('/')}. ${conferido ? 'Pix conferido no extrato Asaas.' : 'Aguardando conferência da secretaria.'}`,
      chave: `oco-comp-${comp.id}-${codAlu}`
    }, { conversaId: conversa.id }).catch(() => null);
  }
  const statusFinal = conferido ? 'sombra_ok' : 'aguardando_humano';
  const motivo = conferido
    ? `Pronto para baixa: ${descricao}, ${reais(valor)} em ${dataBr(dataPag)} (Pix conferido no Asaas${conferidoPorE2e ? ' pelo código E2E' : ' por valor e data — confira o pagador'}).${unidade.baixa_automatica && !conferidoPorE2e ? ' Sem E2E: baixa automática não feita.' : ' Modo sombra: baixe no sistema.'}`
    : `${descricao}, ${reais(valor)} em ${dataBr(dataPag)}. ${extrato.status === 'sem_asaas' ? 'Sem Asaas configurado' : extrato.status === 'ambiguo' ? 'Mais de um Pix com esse valor no extrato' : extrato.status === 'erro' ? 'Erro ao consultar o Asaas' : 'Pix não encontrado no extrato'}: conferir antes de baixar.`;
  await supabase.from('comprovantes').update({ status: statusFinal, ponte_resultado: sim, observacao: motivo }).eq('id', comp.id);
  await supabase.from('pendencias').insert({ unit_id: conversa.unit_id, conversa_id: conversa.id, comprovante_id: comp.id, tipo: 'comprovante', motivo });
  await responder(conversa, `Recebi seu comprovante de ${reais(valor)} 👍\nReferente a: ${descricao}.\nA secretaria vai confirmar o registro e, se precisar de algo, te aviso por aqui.`);
}

/** Depois que a identidade é confirmada, processa comprovantes que aguardavam. */
export async function reprocessarPendentes({ conversa, unidade, segredos }) {
  const ids = conversa.contexto?.comprovantes_pendentes || [];
  if (!ids.length) return 0;
  await atualizarConversa(conversa.id, { contexto: { ...(conversa.contexto || {}), comprovantes_pendentes: [] } });
  for (const id of ids) {
    await processarComprovante(id, { unidade, segredos, conversa });
  }
  return ids.length;
}
