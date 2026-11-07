import { supabase, reais, dataBr, digitos, hojeSP, CFG } from './base.js';
import { ponte } from './ponte.js';
import { agente } from './ia.js';
import { historico, atualizarConversa, chamarHumano, responder } from './conversa.js';
import { garantirCardWhatsapp } from './crmcards.js';
import { reprocessarPendentes } from './comprovante.js';
import { prepararCobranca, emitirCobranca } from './cobranca.js';

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

function sistema(unidade, conversa, grupos, asaasAtivo) {
  const conf = conversa.identidade_confirmada;
  const g = conversa.contexto?.grupo;
  return `Você é a assistente virtual da MULT Profissões (cursos profissionalizantes), unidade ${unidade.name}, no WhatsApp. Hoje é ${dataBr(hojeSP())}.
Atende alunos e responsáveis de forma acolhedora, empática e profissional (padrão de atendimento pedagógico).

ESTILO: português do Brasil, mensagens curtas e humanizadas (no máximo ~5 linhas), sem markdown, sem tabelas,
no máximo 1 emoji. Trate pelo primeiro nome. Uma pergunta por vez. Nunca diga que é humana; se perguntarem, diga que é a assistente virtual.

PASSO 1 — COM QUEM VOCÊ FALA:
- Aluno ou responsável já matriculado: confirme a identidade (abaixo) antes de qualquer dado.
- EMPRESA parceira querendo divulgar/oferecer uma vaga de emprego: não precisa de cadastro — trate como Encaminhamento (veja abaixo).
- Interessado em se matricular, conhecer cursos novos, promoções ou indicação de amigo (LEAD, sem cadastro):
  não é o seu setor — acolha com simpatia e chame chamar_humano com motivo "comercial - novo interesse".

IDENTIFICAÇÃO (obrigatória antes de valores, parcelas, frequência ou carnê):
- Os cadastros encontrados pelo telefone estão em CADASTROS_PELO_TELEFONE (pode estar vazio).
- Se houver um cadastro: pergunte se fala com o responsável (ou o próprio aluno) citando os nomes. Ao confirmar, chame confirmar_identidade com o número do grupo.
- Se houver mais de um, pergunte qual é antes de confirmar. Se não houver, ou a pessoa negar, peça o CPF e chame buscar_por_cpf.
- Nunca revele nomes ou dados para quem não foi confirmado. Um responsável pode ter vários alunos; pergunte sobre qual é o assunto.

PASSO 2 — ENTENDA E CLASSIFIQUE:
Assim que entender a demanda, chame classificar_atendimento(departamento) para registrar na tela do time certo.
Se o assunto for misto, resolva PRIMEIRO a prioridade da pessoa (o que ela pediu), UM assunto por vez; ao concluir,
classifique o próximo assunto e trate/roteie. O que você não resolver, encaminhe para o humano daquele departamento.

== FINANCEIRO ==
- Informe parcelas, vencimentos e valores sempre pela ferramenta consultar_financeiro (nunca invente valores).
- Regras de valor: até o vencimento há desconto de pontualidade de R$ 30,00 por parcela (o valor "em dia" já vem calculado);
  após o vencimento perde o desconto e há juros de 0,33% ao dia (o valor do dia já vem calculado).
- Pagamento: Pix para a chave ${unidade.pix_chave || '(consultar secretaria)'} (${unidade.recebedor_nome || 'MULT Profissões'}) ou na secretaria.
  Depois do Pix, a pessoa envia o comprovante (foto ou PDF) aqui.
${asaasAtivo
  ? `- BOLETO (boleto, carnê, 2ª via, ou como pagar pelo banco): gere o boleto real em dois passos (nunca um carnê genérico).
  1) preparar_cobranca(cod_alu) devolve responsável, vencimento e valor. 2) CONFIRME esses dados com a pessoa.
  3) Só após o "sim", emitir_cobranca devolve o link + Pix copia-e-cola + linha digitável — envie-os. Nunca emita sem a confirmação.
  Se preparar_cobranca der erro de CPF, chame chamar_humano avisando "erro de CPF — gerar boleto".`
  : `- Envie o carnê em PDF (enviar_carne) quando pedirem boleto, carnê ou 2ª via.`}
- Promessa de pagamento com data: agendar_pagamento (até 30 dias).
- Comprovantes são conferidos automaticamente; não peça dados do comprovante.

== PEDAGÓGICO ==
- Acolha com empatia; evitar a evasão é prioridade. Ferramentas: consultar_frequencia (presença/faltas),
  consultar_cronograma_turma (método do curso, dia/horário, módulos), consultar_vagas_turmas (turmas com vaga),
  consultar_status_certificado, consultar_entrega_apostila.
- FALTA: acolha, pergunte o motivo e registre com registrar_pedagogico(tipo="justificativa_falta"). Explique conforme o método do curso:
  rotativo = a aula começa e termina no dia, o conteúdo é reposto/revisto no ciclo; individual = ele retoma de onde parou, não perde matéria;
  sequencial = reforce a assiduidade e ofereça reposição. Problema de pagamento não é motivo para faltar.
- REPOSIÇÃO: ofereça e registre com registrar_pedagogico(tipo="reposicao") — a secretaria agenda e confirma.
- TROCA DE TURMA/HORÁRIO: mostre as vagas (consultar_vagas_turmas) e registre com registrar_pedagogico(tipo="troca_turma").
- DIFICULDADE / foi mal na prova: explique a Garantia de Aprendizado (quem tem frequência pode refazer o módulo sem custo) e registre uma reposição/reforço.
- CERTIFICADO: consulte com consultar_status_certificado. Critérios: presença ≥ 80% e média 7,0. Se elegível e ainda não solicitado, use solicitar_certificado;
  se faltar frequência, diga quantas reposições faltam.
- MATERIAL/APOSTILA: consulte com consultar_entrega_apostila.
- QUER TRANCAR/CANCELAR: tente reverter com carinho (remanejar horário, trocar de curso, transferir a matrícula a um familiar, ou trancar por até 6 meses).
  Registre com registrar_pedagogico(tipo="alerta_evasao") e chame chamar_humano "pedagógico - retenção" (o coordenador formaliza). Nunca deixe o aluno desamparado.
- Numa conversa de falta não trate de finanças, salvo se houver 2+ faltas E parcela vencida — aí ofereça renegociação condicionada à frequência e encaminhe ao financeiro.

== ENCAMINHAMENTO ==
Primeiro identifique quem fala:
- EMPRESA querendo divulgar uma vaga: colha empresa, cargo/vaga, requisitos (horário, salário) e o contato, e registre com registrar_vaga_empresa. Agradeça a parceria.
- ALUNO/RESPONSÁVEL querendo saber de vagas ou se candidatar: pergunte se quer FAZER O TESTE DE PERFIL profissional (rápido, aqui no WhatsApp) ou falar com o atendimento humano do encaminhamento.
  - Falar com humano: chame chamar_humano "encaminhamento - <assunto>".
  - Fazer o teste: faça UMA pergunta por vez, de forma leve, valorizando quem está começando (sem experiência também é bem-vindo):
    1) área/profissão desejada; 2) já trabalhou antes e em quê (ou ainda não); 3) escolaridade; 4) disponibilidade (período/dias e quando pode começar);
    5) tem CNH e em qual região trabalha; 6) pontos fortes; 7) algo a destacar (opcional).
    Ao terminar, monte um resumo do perfil e salve com salvar_perfil_encaminhamento; depois diga que o time de encaminhamento vai analisar o perfil para as vagas.

CHAME UM HUMANO (chamar_humano) quando: pedirem desconto, acordo, renegociação ou parcelamento; cancelamento, trancamento, rescisão
ou transferência; reclamação; valor que a pessoa contesta; pedirem para falar com uma pessoa; ou algo que você não resolve.
Nunca prometa desconto, isenção ou condição especial.

SITUAÇÃO DESTA CONVERSA:
- Identidade confirmada: ${conf ? 'SIM' : 'NÃO'}${conf && g ? ` — responsável ${nomeBonito(g.nome_responsavel)}; alunos: ${g.alunos.map((a) => `${nomeBonito(a.nome)} (cód. ${a.cod_alu})`).join(', ')}` : ''}
- Departamento atual: ${conversa.departamento || 'não definido'}
- Nome no WhatsApp: ${conversa.nome_contato || 'desconhecido'}
- CADASTROS_PELO_TELEFONE: ${JSON.stringify(conf ? [] : resumoGrupos(grupos))}
${unidade.atendimento_humano ? `- Atendimento da secretaria: ${unidade.atendimento_humano}` : ''}
${unidade.instrucoes_agente ? `\nREGRAS DESTA UNIDADE (definidas pela própria unidade — siga-as):\n${unidade.instrucoes_agente}` : ''}`;
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

  const asaasAtivo = !!segredos.asaas;
  const ferramentasTodas = [
    {
      nome: 'classificar_atendimento',
      descricao: 'Classifica o assunto atual e registra o atendimento na tela do departamento certo (abre/garante o card). Chame assim que entender a demanda, e de novo se o assunto mudar. financeiro = boleto/carnê/parcela/mensalidade/pagamento; pedagogico = falta/frequência/reposição/troca de turma/dificuldade/certificado/material/trancar-cancelar; encaminhamento = vaga/emprego/currículo/teste de perfil.',
      parametros: { type: 'object', properties: { departamento: { type: 'string', enum: ['financeiro', 'pedagogico', 'encaminhamento'] }, assunto: { type: 'string', description: 'resumo curto da demanda' } }, required: ['departamento'] },
      executar: async ({ departamento, assunto }) => {
        const dep = ['financeiro', 'pedagogico', 'encaminhamento'].includes(departamento) ? departamento : 'financeiro';
        conversa = await atualizarConversa(conversa.id, { departamento: dep });
        await garantirCardWhatsapp(conversa, { departamento: dep, titulo: assunto || `Atendimento ${dep}`, status: 'andamento' }).catch(() => null);
        return { ok: true, departamento: dep };
      }
    },
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
      nome: 'preparar_cobranca',
      descricao: 'Passo 1 do boleto: calcula a parcela e o valor para um aluno. NÃO gera o boleto ainda. Devolve nome do responsável, vencimento e valor para você CONFIRMAR com a pessoa antes de emitir.',
      parametros: {
        type: 'object',
        properties: {
          cod_alu: { type: 'string' },
          vencimento: { type: 'string', description: 'opcional, DD/MM/AAAA da parcela desejada; sem isso usa a mais antiga em aberto' }
        },
        required: ['cod_alu']
      },
      executar: async ({ cod_alu, vencimento }) => {
        const bloq = exigirIdentidade();
        if (bloq) return bloq;
        const r = await prepararCobranca({ conversa, codAlu: cod_alu, vencimentoBr: vencimento });
        if (r.erro === 'erro_cpf') {
          await chamarHumano(conversa, `Erro de CPF ao gerar boleto de ${r.nome_responsavel || cod_alu}: ${r.mensagem}`);
          pediuHumano = true;
        }
        return r;
      }
    },
    {
      nome: 'emitir_cobranca',
      descricao: 'Passo 2 do boleto: só chame DEPOIS que a pessoa confirmar o valor e o vencimento informados por preparar_cobranca. Gera o boleto (boleto bancário + Pix) e devolve o link, o Pix copia-e-cola e a linha digitável.',
      parametros: { type: 'object', properties: {} },
      executar: async () => {
        const bloq = exigirIdentidade();
        if (bloq) return bloq;
        const r = await emitirCobranca({ conversa, segredos });
        if ((r.emitido || r.reenvio) && (r.boleto_url || r.pix_copia_cola)) {
          const linhas = [
            `Boleto de ${r.valor} (vencimento ${r.vencimento}):`,
            r.boleto_url ? `📄 ${r.boleto_url}` : '',
            r.linha_digitavel ? `Código de barras: ${r.linha_digitavel}` : '',
            r.pix_copia_cola ? `Ou pague por Pix (copia e cola):\n${r.pix_copia_cola}` : ''
          ].filter(Boolean).join('\n');
          const env = await responder(conversa, linhas);
          if (env.ok) documentoEnviado = true;
        }
        return r;
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
      nome: 'consultar_status_certificado',
      descricao: 'Certificado do aluno: emitidos e solicitações em andamento (status e previsão de entrega).',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' } }, required: ['cod_alu'] },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        if (!alunoDoGrupo(cod_alu)) return { erro: 'aluno_fora_do_grupo' };
        return await ponte(conversa.unit_id, 'status_certificado', { cod_alu: String(cod_alu) }, { conversaId: conversa.id });
      }
    },
    {
      nome: 'consultar_cronograma_turma',
      descricao: 'Turma do aluno, método do curso (rotativo/individual/sequencial), dia, horário e módulos.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' } }, required: ['cod_alu'] },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        if (!alunoDoGrupo(cod_alu)) return { erro: 'aluno_fora_do_grupo' };
        return await ponte(conversa.unit_id, 'cronograma_turma', { cod_alu: String(cod_alu) }, { conversaId: conversa.id });
      }
    },
    {
      nome: 'consultar_vagas_turmas',
      descricao: 'Outras turmas do mesmo curso com vaga, para remanejamento/troca de horário.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' } }, required: ['cod_alu'] },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        if (!alunoDoGrupo(cod_alu)) return { erro: 'aluno_fora_do_grupo' };
        return { turmas: await ponte(conversa.unit_id, 'vagas_turmas', { cod_alu: String(cod_alu) }, { conversaId: conversa.id }) };
      }
    },
    {
      nome: 'consultar_entrega_apostila',
      descricao: 'Verifica se o aluno já retirou o material/apostila e a situação.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' } }, required: ['cod_alu'] },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        if (!alunoDoGrupo(cod_alu)) return { erro: 'aluno_fora_do_grupo' };
        return { apostilas: await ponte(conversa.unit_id, 'entrega_apostila', { cod_alu: String(cod_alu) }, { conversaId: conversa.id }) };
      }
    },
    {
      nome: 'solicitar_certificado',
      descricao: 'Coloca o certificado do aluno na fila de emissão da secretaria. Use quando o aluno concluiu e é elegível (presença ≥ 80% e média 7,0).',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' } }, required: ['cod_alu'] },
      executar: async ({ cod_alu }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        const aluno = alunoDoGrupo(cod_alu); if (!aluno) return { erro: 'aluno_fora_do_grupo' };
        const r = await ponte(conversa.unit_id, 'solicitar_certificado', { cod_alu: String(cod_alu), chave: `cert-${conversa.id}-${cod_alu}` }, { conversaId: conversa.id });
        conversa = await atualizarConversa(conversa.id, { departamento: 'pedagogico' });
        await garantirCardWhatsapp(conversa, { departamento: 'pedagogico', titulo: `Certificado - ${primeiroNome(aluno.nome)}`, status: 'andamento' }).catch(() => null);
        await ponte(conversa.unit_id, 'registrar_ocorrencia', { cod_alu: String(cod_alu), texto: `SOLICITAÇÃO DE CERTIFICADO via WhatsApp para ${conversa.telefone}.`, chave: `oco-cert-${conversa.id}-${cod_alu}` }, { conversaId: conversa.id }).catch(() => null);
        return r;
      }
    },
    {
      nome: 'registrar_pedagogico',
      descricao: 'Registra um pedido pedagógico (ocorrência no sistema) e abre o card no Pedagógico para a secretaria executar. tipo: justificativa_falta, reposicao, troca_turma, alerta_evasao.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' }, tipo: { type: 'string', enum: ['justificativa_falta', 'reposicao', 'troca_turma', 'alerta_evasao'] }, detalhe: { type: 'string', description: 'resumo do pedido (motivo, data da aula, turma desejada, etc.)' } }, required: ['cod_alu', 'tipo', 'detalhe'] },
      executar: async ({ cod_alu, tipo, detalhe }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        const aluno = alunoDoGrupo(cod_alu); if (!aluno) return { erro: 'aluno_fora_do_grupo' };
        const prefixo = {
          justificativa_falta: 'JUSTIFICATIVA DE FALTA',
          reposicao: 'SOLICITAÇÃO DE REPOSIÇÃO DE AULA',
          troca_turma: 'SOLICITAÇÃO DE TROCA DE TURMA/HORÁRIO',
          alerta_evasao: 'ALERTA DE RISCO DE EVASÃO'
        }[tipo] || 'PEDIDO PEDAGÓGICO';
        await ponte(conversa.unit_id, 'registrar_ocorrencia', { cod_alu: String(cod_alu), texto: `${prefixo} (via WhatsApp): ${String(detalhe || '').slice(0, 800)}`, chave: `oco-ped-${conversa.id}-${tipo}-${Date.now()}` }, { conversaId: conversa.id }).catch(() => null);
        conversa = await atualizarConversa(conversa.id, { departamento: 'pedagogico' });
        await garantirCardWhatsapp(conversa, { departamento: 'pedagogico', titulo: `${prefixo} - ${primeiroNome(aluno.nome)}`, status: 'andamento', prioridade: tipo === 'alerta_evasao' ? 'alta' : undefined }).catch(() => null);
        return { ok: true, registrado: tipo };
      }
    },
    {
      nome: 'salvar_perfil_encaminhamento',
      descricao: 'Salva o perfil profissional do aluno (teste de encaminhamento) nas ocorrências e abre o card no Encaminhamento. Chame ao terminar o questionário, com o resumo do perfil.',
      parametros: { type: 'object', properties: { cod_alu: { type: 'string' }, perfil: { type: 'string', description: 'resumo do perfil: área desejada, experiência, escolaridade, disponibilidade, CNH/região, pontos fortes, destaques' } }, required: ['cod_alu', 'perfil'] },
      executar: async ({ cod_alu, perfil }) => {
        const bloq = exigirIdentidade(); if (bloq) return bloq;
        const aluno = alunoDoGrupo(cod_alu); if (!aluno) return { erro: 'aluno_fora_do_grupo' };
        await ponte(conversa.unit_id, 'registrar_ocorrencia', { cod_alu: String(cod_alu), texto: `PERFIL PROFISSIONAL (teste de encaminhamento via WhatsApp):\n${String(perfil || '').slice(0, 1500)}`, chave: `oco-perfil-${conversa.id}-${cod_alu}` }, { conversaId: conversa.id }).catch(() => null);
        conversa = await atualizarConversa(conversa.id, { departamento: 'encaminhamento' });
        await garantirCardWhatsapp(conversa, { departamento: 'encaminhamento', titulo: `Perfil profissional - ${primeiroNome(aluno.nome)}`, status: 'andamento' }).catch(() => null);
        return { ok: true, salvo: true };
      }
    },
    {
      nome: 'registrar_vaga_empresa',
      descricao: 'Registra uma vaga oferecida por uma EMPRESA parceira e encaminha para o time de Encaminhamento. Use quando quem fala é uma empresa querendo divulgar vaga (não precisa de identidade de aluno).',
      parametros: { type: 'object', properties: { empresa: { type: 'string' }, cargo: { type: 'string' }, detalhe: { type: 'string', description: 'requisitos, horário, salário, etc.' }, contato: { type: 'string', description: 'telefone/nome do contato na empresa' } }, required: ['empresa', 'cargo'] },
      executar: async ({ empresa, cargo, detalhe, contato }) => {
        conversa = await atualizarConversa(conversa.id, { departamento: 'encaminhamento' });
        await garantirCardWhatsapp(conversa, { departamento: 'encaminhamento', titulo: `Vaga: ${String(cargo || '').slice(0, 60)} - ${String(empresa || '').slice(0, 60)}`, status: 'andamento', prioridade: 'alta' }).catch(() => null);
        await chamarHumano(conversa, `Encaminhamento - NOVA VAGA de empresa parceira. Empresa: ${empresa || '-'}; Cargo: ${cargo || '-'}; Contato: ${contato || conversa.telefone}; Detalhes: ${String(detalhe || '').slice(0, 500)}`);
        pediuHumano = true;
        return { ok: true };
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

  // Com Asaas ativo na unidade: só o boleto real (esconde o carnê genérico).
  // Sem Asaas: cai no carnê em PDF. Respeita a chave de cada unidade.
  const ferramentas = ferramentasTodas.filter((f) => {
    if (f.nome === 'enviar_carne') return !asaasAtivo;
    if (f.nome === 'preparar_cobranca' || f.nome === 'emitir_cobranca') return asaasAtivo;
    return true;
  });

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
    sistema: sistema(unidade, conversa, grupos, !!segredos.asaas),
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
