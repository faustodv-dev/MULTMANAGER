# MULT Manager — mapa de infraestrutura (LEIA ANTES DE MEXER)

> Existem **DOIS sistemas separados** que se parecem mas **não compartilham banco, Vercel nem gateway**.
> Confundir os dois já causou bug (drenador da fila deployado no gateway errado). **Confirme sempre em qual sistema você está.**

## 🟢 PEDAGÓGICO (este repositório — MULTMANAGER)
É aqui que vivem régua de cobrança, régua de faltantes, fila, ocorrências, atendimento pedagógico.

| Peça | Onde |
|---|---|
| Repo (front + API Vercel) | `faustodv-dev/MULTMANAGER` (este) |
| Vercel | projeto **`mult-financeiro`** (`mult-financeiro.vercel.app`) — Hobby, **limite de 12 Serverless Functions** |
| Supabase | **`jrdrglfzvloxqbuuxhaq`** = "MULT CRM Pedagogico" (região sa-east-1) |
| IDs de unidade | **amigáveis**: `rio_verde`, `aparecida_goiania`, `anapolis`, `agua_boa`, `bom_jesus` |
| Gateway WhatsApp | serviço **`mult-financeiro-gateway`**, projeto Render **"Gateway Pedagogico"** (`prj-dbkca68473hc738940b0`), **em OUTRA conta Render** (outro usuário, criada para não estourar banda do free). Repo do gateway NÃO está na conta GitHub `faustodv-dev`. |
| Ponte (banco escolar) | PHP no cPanel do cliente (HMAC); `PONTE_URL`/`PONTE_SEGREDO` no Vercel `mult-financeiro` |
| A FILA (`fila_mensagens`) | vive **só** em `jrdrglfzvloxqbuuxhaq`. O drenador da fila **tem que rodar no `mult-financeiro-gateway`** e ler ESTE banco. |

## 🔵 COMERCIAL / AI Studio (NÃO é este projeto)
Separado. Só serviu de **inspiração**. **Nunca** deployar mudança do pedagógico aqui.

| Peça | Onde |
|---|---|
| Repo | `faustodv-dev/AISTUDIO-MULTMANAGER` |
| Vercel | projeto **`multmanager`** (`multmanager.vercel.app`) |
| Supabase | **`mpzupaofcmuaiiitgzud`** = "Mult Manager CRM" |
| IDs de unidade | **aleatórios** (ex.: `Q60oB7mFhvUZy1zsboAV` = Rio Verde). Se você vê ids aleatórios, está no sistema COMERCIAL. |
| Gateway WhatsApp | serviço **`mult-whatsapp-gateway`**, repo `faustodv-dev/mult-whatsapp-gateway`, Render **"My Workspace"** (`tea-db7rcvrncjis73fav8ag`, conta `faustodv@gmail.com`). ⚠️ **Este é o COMERCIAL. NÃO mexer para o pedagógico.** |

## 🟣 DIÁRIO DE BORDO (sistema CONECTADO — Fase 4, NÃO é este repo)
Sistema de gamificação/jornada do aluno (missões, candidaturas, vagas). **Estratégia: conectar, não migrar.** A agência oficial continua a do nosso CRM. Leitura **sob demanda** do `missoes` (no clique), que bate na quota do Diário, não na nossa — nada de cron/cross-read contínuo.

| Peça | Onde |
|---|---|
| Supabase | **`qtaxuzubejquqfeflsjy`** = "DIARIO DE BORDO", org **`multprofissoesoficial`** (FREE). **Conta/org SEPARADA** — **NÃO alcançável** pelo nosso MCP Supabase (só vemos a org `nvhdlkvzxbcpxpdxnnpq`). Schema vem de prints do Fausto. |
| Tabelas | `candidaturas`, `cursos`, `empresas`, `franquias`, `matriculas`, `missoes`, `usuarios`, `vagas` |

**`usuarios`** (colunas confirmadas por print): `id` text = `{franquia_id}_{codigo}` (ex.: `aparecida_5475`) · `uid` (auth) · `email` = `{id}@mult.com.br` · `display_name` (nome do aluno) · **`codigo` = `cod_alu` do MULT ✓** · `role` (`aluno`…) · `franquia_id` (ex.: `aparecida`).

**Ponte de identidade:** Diário `usuarios.codigo` == MULT `cod_alu`. Chave composta: `missoes.student_id` == `usuarios.id` == `${franquia_id}_${cod_alu}` (ex.: `rio-verde_14017`).

**LIGADO (Fase 4) — leitura direta, NÃO deep-link.** O Diário não tem URL por aluno, então em vez de link a gente **lê o `missoes` direto** por um 2º cliente Supabase (só no servidor): `api/_lib/diario.js`, env **`DIARIO_SUPABASE_URL`** + **`DIARIO_SUPABASE_SERVICE_KEY`** no Vercel `mult-financeiro` (⚠️ foram parar no `multmanager`/comercial por engano uma vez — confira o projeto certo). Ação `diario_aluno` no `crm.js`; seção "Ver Diário de Bordo" na ficha do card (`Departamento.tsx`), sob demanda. **Egress bate na quota do DIÁRIO, não na nossa.**
- **De-para** (tabela `franquias`): `rio_verde`→`rio-verde`, `aparecida_goiania`→`aparecida`. **Só estas 2 unidades têm Diário** (anapolis/agua_boa/bom_jesus não existem lá → seção some).
- **`missoes`** (colunas usadas): `student_id`, `student_name`, `module` (módulo), `class_num` (aula), `course_name`, `turma`, `status` (approved/pending/…), `content` (texto do aluno), `ai_feedback` (retorno da IA), `xp_awarded` (XP/missão), `created_at`. XP total = soma de `xp_awarded` (o Diário não guarda total em `usuarios`).

## Como saber em qual você está (checagem rápida)
- IDs de unidade **amigáveis** (`rio_verde`) → pedagógico (`jrdrglfzvloxqbuuxhaq`).
- IDs **aleatórios** (`Q60oB7...`) → comercial (`mpzupaofcmuaiiitgzud`).
- O banco comercial **não tem** `fila_mensagens`/`regua`; o pedagógico tem.

## Regras de ouro
1. Não podemos estragar o que já funciona. Cada subetapa precisa de autorização antes de codar.
2. Vercel pedagógico é **Hobby**: não ultrapassar **12 funções** em `api/*.js` (dobrar lógica em endpoints existentes, não criar rota nova). Não migrar para Pro sem combinar.
3. Gateways são **free tier**: um gateway always-on por sistema (vários estouram as 750h). Keep-awake externo mantém de pé; após deploy, a instância reconecta as sessões sozinha a partir do Supabase.
4. Régua financeira segue por envio direto (Vercel→gateway HTTP) até migrarmos para a fila com o fix do log de hora real.
5. No fim de tudo: rotacionar o segredo exposto (ponte + `PONTE_SEGREDO`) e a senha do banco escolar (`neto_ponte`).

## Pendências conhecidas
- **4d — frequência vs reposição do MULT (cosmético, não afeta risco).** O % de frequência usa `(presenças + reposições de s_cad_reposicao) ÷ qtd_tot_aul da turma atual`, somando as turmas **dentro da mesma matrícula** (1 matrícula = 1 curso; nunca somar cursos diferentes). Às vezes o número fica **acima do MULT** (ex.: aluno 13847 deu 172% vs 131% no MULT) — provável **contagem de reposição a mais**: a `s_cad_reposicao` deve ter mais linhas que o "Quantd. Reposição" do MULT (talvez 1 linha por sessão, ou inclui agendadas/canceladas). Para cravar: inspecionar as colunas de `s_cad_reposicao` (tem status/data? granularidade?) e ajustar a contagem. Cálculo em `ponte/lib/Escola.php::faltantesDoDia`. A classificação de risco não depende disso (sinal forte = **faltas seguidas**).
- **Régua financeira (cobrança) — estado por unidade (22/11).** **Rio Verde** e **Aparecida**: cobrança ATIVA e **já na fila** (`via_fila=true`, 9h) — hora real + ocorrência por envio, funcionando. **Água Boa, Anápolis, Bom Jesus**: DESLIGADAS **de propósito** (acesso à ferramenta ainda não liberado para elas). O `REGUA_PADRAO` segue `ativa=false`/`via_fila=false` (`api/_lib/regua.js`), então **unidade nova** nasce desligada e, se ligada, começa em **envio direto** — ao liberar uma nova unidade, ligar `ativa` **e** `via_fila` nela.
- **Rotação de segredos (Regra de ouro 5).** Ainda pendente — fazer no fim: `PONTE_SEGREDO`/ponte e a senha `neto_ponte`.
- **`baixa_automatica` — dupla fonte de verdade (SÁBADO).** Há DOIS flags que não conversam: (A) `units.baixa_automatica` no nosso Supabase (o que o toggle "Baixa automática" do master lê/grava e o CRM usa no Asaas auto-baixa e no texto da sugestão — `comprovante.js`, `asaas-webhook.js`); (B) `baixa_automatica` no `config.php` da **ponte no cPanel**, que é o ÚNICO que decide a baixa real (`ponte/index.php:155` → `empty($U['baixa_automatica']) ? throw 'baixa_desligada'`). O CRM **não envia** o flag na chamada `baixar` (payload em `comprovante-acao.js` só tem cod_pars/valor/data/chave/origem) → o master pode mostrar LIGADO (A=`true`) enquanto a ponte recusa (B=`false`). Caso real 25/11: Rio Verde A=`true` no Supabase, mas baixa dá `baixa_desligada` → ponte dela está com B=`false`. **Correção paliativa:** editar o `config.php` da ponte no cPanel (`'baixa_automatica' => true` e conferir `'somente_leitura' => false`) da unidade. **Correção definitiva (código, aprovar):** o CRM **enviar** `baixa_automatica` na chamada `baixar` e a ponte **honrar o valor recebido** em vez do config dela — fonte única, o botão do master passa a mandar de verdade.
- **Faltantes inteligente (adiado — decisão Fausto 23/11).** Mantém o formato atual por enquanto. Ideia futura (do Manual do Coordenador): lista priorizada por risco + abordagem por padrão de falta (1 falta / alternadas / 2 consecutivas / +2).
- **Agente sem `consultar_notas` (e, futuro, `consultar_progresso`).** O atendente (`api/_lib/atendente.js`) tem consultar_financeiro/frequencia/cronograma/vagas/status_certificado/entrega_apostila, mas NÃO lê notas. Com o boletim citando notas, o responsável pode perguntar sobre uma nota e o agente não busca. Adicionar `consultar_notas` (lê `s_cad_nota` via ponte) **junto do boletim**. Avaliar também dar ao agente o contexto da **última régua enviada** (hoje ele infere pelo texto) conforme as réguas crescem.
- **Encaminhamentos realizados na ficha da agência (fonte da verdade).** A Solicitação de Encaminhamento tem a seção "Encaminhado para 1/2/3 · contratado sim/não". Hoje o encaminhamento é lançado no **sistema MULT**, não no nosso CRM (que tem a tabela `encaminhamentos` do match). Falta **definir onde essa informação vive**: puxar do CRM, integrar com o MULT, ou campo manual — e então exibir na ficha/Solicitação. Decidir com o Fausto.
- **OOM do gateway (status 134/SIGABRT).** Free tier 512MB (Baileys). Gateway se recupera sozinho; resolver quando o Fausto enviar os arquivos do gateway (index.js, package.json, módulos de sessão/store). Mexer no Render do gateway é arriscado — só com arquivos em mãos.
- **Nome do card por pushname do WhatsApp (polimento, baixo risco).** Card de WhatsApp usa o `nome_aluno` = pushname do contato (pode ser ".", só emoji, apelido). Quando for lixo, cair pro nome oficial do MULT; e exibir o `nome_responsavel` da **conversa** na ficha (o card não carrega esse campo → hoje mostra "—"). Ex.: card 14122 tem `nome_aluno='.'` mas a conversa sabe o responsável `ELIZANE SILVA SOUSA`.
- **Jitter fino de envio no gateway (anti-bloqueio — parte 2).** O agendador central (`api/_lib/disparos.js`) já classifica aberta/nova, respeita o teto diário por unidade (`units.disparos`, editável em Central de Disparos) e espalha o `agendado_para`. Falta o **delay humano com jitter entre envios no próprio gateway** (Baileys) — só dá pra fazer com os arquivos do gateway em mãos (mesma pendência do OOM). Incidente que originou isto: 23/11, chip de Rio Verde restringido por rajada (faltantes: 53 msgs em 13 min + cobrança: 18 em 3 min, backlog de feriado+sábado+dia 20).
- **API oficial do WhatsApp (Cloud API) para massa.** Caminho definitivo para boletim/réguas em volume sem risco de bloqueio (tem custo por conversa). Decisão estratégica com o Fausto.
- **Rotação de segredos — incluir `DIARIO_SUPABASE_SERVICE_KEY`.** Além do `PONTE_SEGREDO` e senha `neto_ponte` (Regra de ouro 5), rotacionar a service_key do Diário, que passou pelo projeto Vercel comercial (`multmanager`) por engano antes de ir pro `mult-financeiro`.
