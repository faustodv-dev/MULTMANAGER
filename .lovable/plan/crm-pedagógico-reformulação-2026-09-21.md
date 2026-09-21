# CRM Pedagógico — reformulação

Entendi os três pontos. Abaixo o que entendi e o que faria. Nada será implementado até sua confirmação.

## 1. Cadastro simplificado + tabela de Alunos

**Conceito que entendi:** o registro principal do CRM deixa de ser um "lead comercial" e passa a ser uma **Tarefa/Atendimento pedagógico**. O aluno é uma entidade separada e reutilizável: o mesmo aluno pode ter várias tarefas ao longo do tempo. As atividades (anotações/histórico) ficam ligadas à tarefa **e** ao aluno.

Nova tabela **Alunos**:
- Nome
- Código (código do aluno no sistema de gestão escolar)
- Unidade (vinculada automaticamente ao usuário)

No cadastro de uma Tarefa do CRM o usuário poderá:
- Buscar um aluno existente por nome ou código
- Escolher de uma lista
- Cadastrar um aluno novo na hora

Campos que ficam no cadastro da Tarefa: nome/título do atendimento, aluno vinculado, etapa da pipeline, responsável, data de retorno, observações.

Campos removidos da tela (dados comerciais): e-mail, telefone/WhatsApp, CPF, data de nascimento, curso de interesse, escolaridade, diploma, origem de mídia, campanha, valores de orçamento/desconto. Os dados ficam preservados no banco, apenas somem da interface — nada é apagado.

A aba **Atividades** passa a aparecer logo abaixo do cadastro, na mesma tela, com o mesmo padrão de anotações e histórico. Cada atividade guarda o aluno além da tarefa, permitindo ver o histórico completo do aluno em todos os atendimentos.

## 2. Relatórios financeiros

A aba/menu de Relatórios Financeiros fica **oculta** (removida do menu e da rota). O código e os dados permanecem intactos para reativação futura.

## 3. Dashboard — card único por processo + histórico

**Conceito que entendi:** hoje tarefas recorrentes se repetem e, na virada do mês, os cards finalizados precisam ser reposicionados manualmente. Você quer que **cada processo tenha um único card vivo no quadro**. Ao concluir, o card sai do quadro ativo e é arquivado num **histórico de atividades realizadas na unidade** — permanentemente salvo, consultável por período. Na virada do ciclo (dia/semana/mês conforme a frequência), o card único reaparece no quadro como "A Fazer", sem duplicar nem perder o registro anterior.

Implementação: uma tabela de **histórico de conclusões** (tarefa, processo, quem concluiu, data, unidade). O quadro mostra apenas o card ativo de cada processo; uma nova tela "Histórico" lista tudo que já foi concluído, com filtros por período, unidade e responsável.

## Detalhes técnicos

- Nova tabela `students` (nome, código, unidade) com regras de acesso por unidade; código único por unidade.
- `leads` ganha `student_id`; `lead_activities` ganha `student_id`.
- Nova tabela `task_completions` para o histórico; `tasks` ganha um marcador de ciclo atual para evitar duplicação.
- Rota e item de menu de Relatório Financeiro desativados (arquivos mantidos).
- Nova rota `/historico` com listagem e filtros.

## Pontos que preciso confirmar

1. A pipeline atual (Assuntos Pendentes, Pendência EJA/Online/Técnico, Desistentes, Rescisão/Cancelamento, Finalizado) permanece igual?
2. O código do aluno é único por unidade ou único no sistema inteiro?
3. Ao virar o ciclo, o card deve voltar automaticamente para "A Fazer", ou só quando alguém abrir o quadro no novo período?
