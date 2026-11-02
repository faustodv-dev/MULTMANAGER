import { supabase, reais, dataBr, digitos, hojeSP, CFG } from './base.js';
import { ponte } from './ponte.js';
import { agente } from './ia.js';
import { historico, atualizarConversa, chamarHumano, responder } from './conversa.js';
import { reprocessarPendentes } from './comprovante.js';

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase()) || '';
const nomeBonito = (n) => String(n || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function resumoGrupos(grupos) {
  return grupos.map((g, i) => ({
    grupo: i + 1,
    responsavel: nomeBonito(g.nome_responsavel),
    responsavel_e_o_proprio_aluno: g.responsavel_e_aluno,
    alunos: g.alunos.map((a) => ({
      nome: nomeBonito(a.nome),
      cursos: a.matriculas.filter((m) => /ativo/i.test(m.status)).map((m) => m.curso_nome),
      ativo: a.ativo
    }))
  }));
}

function sistema(unidade, conversa, grupos) {
  const conf = conversa.identidade_confirmada;
  const g = conversa.contexto?.grupo;
  return `Você é a assistente virtual do FINANCEIRO da MULT Profissões (cursos profissionalizantes), unidade ${unidade.name}.
Atende pelo WhatsApp alunos e responsáveis. Hoje é ${dataBr(hojeSP())}.

ESTILO: português do Brasil, mensagens curtas e acolhedoras (no máximo ~5 linhas), sem markdown, sem tabelas,
no máximo 1 emoji. Trate pelo primeiro nome. Nunca diga que é humana; se perguntarem, diga que é a assistente virtual.

IDENTIFICAÇÃO (obrigatória antes de falar de valores, parcelas, frequência ou enviar carnê):
- Os cadastros encontrados pelo telefone do contato estão em CADASTROS_PELO_TELEFONE (pode estar vazio).
- Se houver um cadastro: pergunte se fala com o responsável indicado (ou com o próprio aluno) citando os nomes.
  Quando a pessoa confirmar, chame confirmar_identidade com o número do grupo e forma="nome".
- Se houver mais de um cadastro, pergunte qual é o dela antes de confirmar.
- Se não houver cadastro, ou a pessoa disser que não é ela, peça o CPF do responsável financeiro (ou do aluno)
  e chame buscar_por_cpf. Nunca revele nomes ou dados para quem não foi confirmado.
- Um responsável pode ter vários alunos (filhos). Pergunte sobre qual aluno é o assunto, ou trate todos juntos.

O QUE VOCÊ FAZ:
- Informar parcelas em aberto, vencimentos e valores (sempre pela ferramenta consultar_financeiro; nunca invente valores).
- Regras de valor: pagando até o vencimento há desconto de pontualidade de R$ 30,00 por parcela (o valor "em dia"
  já vem calculado). Após o vencimento perde o desconto e há juros de 0,33% ao dia (o valor do dia já vem calculado).
- Formas de pagamento: Pix para a chave ${unidade.pix_chave || '(consultar secretaria)'} (${unidade.recebedor_nome || 'MULT Profissões'}) ou no balcão da secretaria.
  Não aceitamos boleto bancário. Depois do Pix, a pessoa deve enviar o comprovante (foto ou PDF) aqui.
- Enviar o carnê em PDF (enviar_carne) quando pedirem boleto, carnê ou segunda via.
- Registrar promessa de pagamento com data (agendar_pagamento), até 30 dias.
- Consultar frequência (consultar_frequencia). Se o aluno estiver faltando, incentive com carinho a voltar às aulas:
  falta de pagamento não é motivo para deixar de frequentar; problemas financeiros se resolvem com a secretaria.
- Comprovantes enviados são conferidos automaticamente pelo sistema; você não precisa pedir dados do comprovante.

CHAME UM HUMANO (chamar_humano) e avise que a secretaria vai responder quando: pedirem desconto, acordo, renegociação
ou parcelamento; cancelamento, trancamento, rescisão ou transferência; reclamação; valor que a pessoa contesta;
assunto pedagógico que você não resolve; pedirem para falar com uma pessoa; ou qualquer dúvida fora do financeiro.
Nunca prometa desconto, isenção ou condição especial.

SITUAÇÃO DESTA CONVERSA:
- Identidade confirmada: ${conf ? 'SIM' : 'NÃO'}${conf && g ? ` — responsável ${nomeBonito(g.nome_responsavel)}; alunos: ${g.alunos.map((a) => `${nomeBonito(a.nome)} (cód. ${a.cod_alu})`).join(', ')}` : ''}
- Nome no WhatsApp: ${conversa.nome_contato || 'desconhecido'}
- CADASTROS_PELO_TELEFONE: ${JSON.stringify(conf ? [] : resumoGrupos(grupos))}
${unidade.atendimento_humano ? `- Atendimento da secretaria: ${unidade.atendimento_humano}` : ''}`;
}

/** Executa o agente para a conversa e envia a resposta. */
export async function atender({ conversa, unidade, segredos }) {
  let grupos = conversa.contexto?.candidatos;
  const velho = !conversa.contexto?.candidatos_em || Date.now() - new Date(conversa.contexto.candidatos_em).getTime() > 6 * 3600 * 1000;
  if (!conversa.identidade_confirmada && (!grupos || velho)) {
    grupos = await ponte(conversa.unit_id, 'buscar_telefone', { telefone: conversa.telefone }, { conversaId: conversa.id }).catch(() => []);
    conversa = await atualizarConversa(conversa.id, { contexto: { ...(conversa.contexto || {}), candidatos: grupos, candidatos_em: new Date().toISOString() } });
  }
  grupos = grupos || [];

  const exigirIdentidade = () => {
    if (!conversa.identidade_confirmada) return { erro: 'identidade_nao_confirmada', mensagem: 'Confirme a identidade antes.' };
    return null;
  };
  const alunoDoGrupo = (codAlu) => {
    const alunos = conversa.contexto?.grupo?.alunos || [];
    return alunos.find((a) => a.cod_alu === String(codAlu));
  };
  const confirmar = async (grupo, forma) => {
    conversa = await atualizarConversa(conversa.id, {
      identidade_confirmada: true,
      cpf_responsavel: grupo.cpf_responsavel || null,
      nome_responsavel: grupo.nome_responsavel || null,
      cod_alus: grupo.alunos.map((a) => a.cod_alu),
      contexto: {
        ...(conversa.contexto || {}),
        grupo: { nome_responsavel: grupo.nome_responsavel, cpf_responsavel: grupo.cpf_responsavel, alunos: grupo.alunos.map((a) => ({ cod_alu: a.cod_alu, nome: a.nome, matriculas: a.matriculas })) },
        confirmado_por: forma,
        confirmado_em: new Date().toISOString()
      }
    });
    houveConfirmacao = true;
    return {
      ok: true,
      responsavel: nomeBonito(grupo.nome_responsavel),
      alunos: grupo.alunos.map((a) => ({ cod_alu: a.cod_alu, nome: nomeBonito(a.nome), ativo: a.ativo }))
    };
  };
  let houveConfirmacao = false;
  let pediuHumano = false;
  let documentoEnviado = false;

  const ferramentas = [
    {
      nome: 'confirmar_identidade',
      descricao: 'Marca a identidade como confirmada depois que o contato confirmou ser o responsável (ou o aluno) de um dos CADASTROS_PELO_TELEFONE.',
      parametros: { type: 'object', properties: { grupo: { type: 'integer', description: 'número do grupo em CADASTROS_PELO_TELEFONE' } }, required: ['grupo'] },
      executar: async ({ grupo }) => {
        const g = grupos[Number(grupo) - 1];
        if (!g) return { erro: 'grupo_invalido' };
        return confirmar(g, 'telefone+nome');
      }
    },
    {
      nome: 'buscar_por_cpf',
      descricao: 'Procura o cadastro pelo CPF informado pelo contato (do responsável ou do aluno). Se encontrar, a identidade fica confirmada.',
      parametros: { type: 'object', properties: { cpf: { type: 'string' } }, required: ['cpf'] },
      executar: async ({ cpf }) => {
        if (digitos(cpf).length !== 11) return { erro: 'cpf_invalido', mensagem: 'CPF precisa ter 11 dígitos.' };
        const tentativas = (conversa.contexto?.tentativas_cpf || 0) + 1;
        conversa = await atualizarConversa(conversa.id, { contexto: { ...(conversa.contexto || {}), tentativas_cpf: tentativas } });
        if (tentativas > 3) return { erro: 'muitas_tentativas', mensagem: 'Chame um humano.' };
        const gs = await ponte(conversa.unit_id, 'buscar_cpf', { cpf }, { conversaId: conversa.id });
        if (!gs.length) return { encontrado: false };
        // CPF do responsável tem prioridade; se for CPF de aluno, usa o grupo dele
        const g = gs.find((x) => x.cpf_responsavel === digitos(cpf)) || gs[0];
        return { encontrado: true, ...(await confirmar(g, 'cpf')) };
      }
    },
    {
      nome: 'consultar_financeiro',
      descricao: 'Parcelas em aberto (vencidas e próximas) dos alunos do responsável confirmado, com o valor devido hoje e o valor até o vencimento.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string', description: 'opcional: só deste aluno' } } },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade();
        if (bloq) return bloq;
        const alvo = cod_alu && alunoDoGrupo(cod_alu) ? [String(cod_alu)] : conversa.cod_alus;
        const hoje = hojeSP();
        const r = await ponte(conversa.unit_id, 'parcelas', { cod_alus: alvo, data_referencia: hoje }, { conversaId: conversa.id });
        const ag = await ponte(conversa.unit_id, 'agendamentos', { cod_alus: alvo }, { conversaId: conversa.id }).catch(() => []);
        const vencidos = r.documentos.filter((d) => d.vencimento < hoje);
        const proximos = r.documentos.filter((d) => d.vencimento >= hoje).slice(0, 3);
        const fmt = (d) => ({
          aluno: nomeBonito(alunoDoGrupo(d.cod_alu)?.nome || d.cod_alu),
          cod_alu: d.cod_alu,
          vencimento: dataBr(d.vencimento),
          parcelas: d.cod_pars.length,
          valor_hoje: reais(d.valor_devido),
          valor_ate_vencimento: d.vencido ? null : reais(d.valor_em_dia),
          dias_atraso: d.dias_atraso,
          juros: d.juros ? reais(d.juros) : null
        });
        return {
          vencidos: vencidos.map(fmt),
          total_vencido_hoje: reais(vencidos.reduce((s, d) => s + d.valor_devido, 0)),
          proximos: proximos.map(fmt),
          quantidade_a_vencer: r.documentos.length - vencidos.length,
          agendamentos: ag.map((a) => ({ aluno: nomeBonito(alunoDoGrupo(a.cod_alu)?.nome || a.cod_alu), pagar_em: dataBr(a.data_pagamento) }))
        };
      }
    },
    {
      nome: 'consultar_frequencia',
      descricao: 'Frequência do aluno: percentual de presença, faltas seguidas e últimas aulas.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' } }, required: ['cod_alu'] },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade();
        if (bloq) return bloq;
        if (!alunoDoGrupo(cod_alu)) return { erro: 'aluno_fora_do_grupo' };
        const f = await ponte(conversa.unit_id, 'frequencia', { cod_alu }, { conversaId: conversa.id });
        return f.map((m) => ({
          turma: m.turma, presenca: m.percentual_presenca != null ? `${m.percentual_presenca}%` : 'sem registros',
          faltas_seguidas: m.faltas_seguidas_atuais, ultima_aula: dataBr(m.ultima_aula)
        }));
      }
    },
    {
      nome: 'enviar_carne',
      descricao: 'Gera e envia o carnê em PDF pelo WhatsApp (parcelas vencidas + a próxima, ou só os vencimentos pedidos).',
      parametros: {
        type: 'object',
        properties: {
          cod_alu: { type: 'string' },
          vencimentos: { type: 'array', items: { type: 'string' }, description: 'opcional, datas DD/MM/AAAA dos carnês desejados' }
        },
        required: ['cod_alu']
      },
      executar: async ({ cod_alu, vencimentos }) => {
        const bloq = exigirIdentidade();
        if (bloq) return bloq;
        const aluno = alunoDoGrupo(cod_alu);
        if (!aluno) return { erro: 'aluno_fora_do_grupo' };
        let codPars = [];
        if (Array.isArray(vencimentos) && vencimentos.length) {
          const iso = vencimentos.map((v) => String(v).split('/').reverse().join('-'));
          const r = await ponte(conversa.unit_id, 'parcelas', { cod_alus: [String(cod_alu)], data_referencia: hojeSP() }, { conversaId: conversa.id });
          codPars = r.documentos.filter((d) => iso.includes(d.vencimento)).flatMap((d) => d.cod_pars);
          if (!codPars.length) return { erro: 'vencimento_nao_encontrado' };
        }
        const c = await ponte(conversa.unit_id, 'carne', { cod_alu: String(cod_alu), cod_pars: codPars }, { conversaId: conversa.id, timeoutMs: 30000 });
        const caminho = `${conversa.unit_id}/enviados/${Date.now()}_${c.arquivo}`;
        await supabase.storage.from(CFG.bucket).upload(caminho, Buffer.from(c.pdf_base64, 'base64'), { contentType: 'application/pdf' });
        const env = await responder(conversa, `Carnê de ${primeiroNome(aluno.nome)} 📄`, {
          documento: { base64: c.pdf_base64, fileName: c.arquivo, mimeType: 'application/pdf' },
          midia: { path: caminho, tipo: 'application/pdf', nome: c.arquivo }
        });
        if (!env.ok) return { erro: 'falha_envio' };
        documentoEnviado = true;
        await ponte(conversa.unit_id, 'registrar_ocorrencia', {
          cod_alu: String(cod_alu),
          texto: `CARNÊ ENVIADO VIA WHATSAPP (${c.documentos.map((d) => dataBr(d.vencimento)).join(', ')}) para ${conversa.telefone}.`,
          chave: `oco-carne-${conversa.id}-${c.arquivo}`
        }, { conversaId: conversa.id }).catch(() => null);
        return { enviado: true, vencimentos: c.documentos.map((d) => dataBr(d.vencimento)), valores_em_dia: c.documentos.map((d) => reais(d.valor_em_dia)) };
      }
    },
    {
      nome: 'agendar_pagamento',
      descricao: 'Registra no sistema a data em que o contato promete pagar uma parcela vencida (no máximo 30 dias).',
      parametros: {
        type: 'object',
        properties: {
          cod_alu: { type: 'string' },
          vencimento: { type: 'string', description: 'vencimento da parcela, DD/MM/AAAA' },
          data_pagamento: { type: 'string', description: 'data prometida, DD/MM/AAAA' }
        },
        required: ['cod_alu', 'vencimento', 'data_pagamento']
      },
      executar: async ({ cod_alu, vencimento, data_pagamento }) => {
        const bloq = exigirIdentidade();
        if (bloq) return bloq;
        if (!alunoDoGrupo(cod_alu)) return { erro: 'aluno_fora_do_grupo' };
        const iso = String(data_pagamento).split('/').reverse().join('-');
        const limite = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso > limite) return { erro: 'data_fora_do_limite', mensagem: 'Acima de 30 dias: chame um humano.' };
        const r = await ponte(conversa.unit_id, 'agendar_pagamento', {
          cod_alu: String(cod_alu), vencimento, data_pagamento, chave: `ag-${conversa.id}-${cod_alu}-${iso}`
        }, { conversaId: conversa.id });
        return { agendado: true, id: r.agendamento_id };
      }
    },
    {
      nome: 'chamar_humano',
      descricao: 'Passa a conversa para a secretaria. Depois disso você não responde mais nesta conversa.',
      parametros: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] },
      executar: async ({ motivo }) => {
        await chamarHumano(conversa, String(motivo || 'Pedido de atendimento humano'));
        pediuHumano = true;
        return { ok: true };
      }
    }
  ];

  const hist = await historico(conversa.id, 24);
  const linhas = hist
    .filter((m) => m.texto || m.midia_nome)
    .map((m) => ({
      papel: m.direcao === 'out' ? 'assistente' : 'usuario',
      texto: (m.autor === 'humano' ? '[secretaria] ' : '') + (m.texto || `[arquivo: ${m.midia_nome}]`)
    }));
  // Gemini exige começar pelo usuário
  while (linhas.length && linhas[0].papel !== 'usuario') linhas.shift();
  if (!linhas.length) return;

  const r = await agente({
    sistema: sistema(unidade, conversa, grupos),
    historico: linhas,
    ferramentas,
    chaves: { gemini: segredos.gemini, groq: segredos.groq },
    unitId: conversa.unit_id,
    conversaId: conversa.id
  });

  let texto = (r.texto || '').trim();
  if (!texto && !documentoEnviado) {
    if (!pediuHumano) await chamarHumano(conversa, 'A assistente não conseguiu responder.');
    texto = 'Vou pedir para alguém da secretaria continuar seu atendimento por aqui, tudo bem? 😊';
  }
  if (texto) await responder(conversa, texto);

  if (houveConfirmacao) {
    await reprocessarPendentes({ conversa, unidade, segredos });
  }
}
