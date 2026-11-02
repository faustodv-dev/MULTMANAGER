-- CRM operacional por departamento: Kanban de atendimentos (cards/dossiê) + Agenda/POPs
-- Departamentos: financeiro, pedagogico, encaminhamento. Permissão reusa public.pode(unit, departamento).

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ───────────────────────── Cards (dossiê do aluno por departamento) ─────────────────────────
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id) on delete cascade,
  departamento text not null check (departamento in ('financeiro','pedagogico','encaminhamento')),
  cod_alu text,                                   -- aluno no sistema escolar (null = demanda avulsa)
  nome_aluno text,
  nome_responsavel text,
  telefone text,
  titulo text not null,
  descricao text,
  status text not null default 'novo',            -- novo, andamento, aguardando, resolvido
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  prazo date,
  canal_origem text not null default 'presencial' check (canal_origem in ('whatsapp','presencial','simulador','sistema')),
  conversa_id uuid references public.conversas(id) on delete set null,
  resolvido_em timestamptz,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Card = 1 atendimento (demanda) com começo-meio-fim; vários por aluno. O histórico do aluno
-- é a soma dos cards (abertos e finalizados) pelo cod_alu.
create index cards_board_idx on public.cards (unit_id, departamento, status);
create index cards_resp_idx on public.cards (responsavel_id);
create index cards_aluno_idx on public.cards (unit_id, cod_alu);
create trigger cards_touch before update on public.cards for each row execute function public.touch_updated_at();

-- ───────────────────────── Linha do tempo do card (histórico "PROCON") ─────────────────────────
create table public.card_eventos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  unit_id text not null,
  departamento text not null,
  tipo text not null,                             -- nota, mensagem, ocorrencia, boleto, comprovante, status, sistema
  descricao text,
  dados jsonb,
  autor_id uuid references public.profiles(id) on delete set null,
  autor_nome text,
  criado_em timestamptz not null default now()
);
create index card_eventos_idx on public.card_eventos (card_id, criado_em);

-- ───────────────────────── Catálogo de POPs ─────────────────────────
create table public.pops (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id) on delete cascade,
  departamento text not null check (departamento in ('financeiro','pedagogico','encaminhamento')),
  titulo text not null,
  procedimento text,
  frequencia text not null check (frequencia in ('diaria','semanal','mensal','dia_fixo')),
  dia_do_mes int,                                 -- usado quando frequencia = dia_fixo
  responsavel_sugerido text,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index pops_idx on public.pops (unit_id, departamento, ativo);

-- ───────────────────────── Execuções de POP (registros da agenda) ─────────────────────────
create table public.pop_execucoes (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id) on delete cascade,
  pop_id uuid references public.pops(id) on delete set null,
  departamento text not null,
  titulo text not null,
  procedimento text,
  frequencia text,
  periodo_ref text not null,                      -- 'YYYY-MM-DD' (diária) | 'YYYY-Www' (semanal) | 'YYYY-MM' (mensal)
  data_prevista date,
  hora_prevista time,                             -- opcional (matriz por hora)
  prazo date,
  responsavel_id uuid references public.profiles(id) on delete set null,
  status text not null default 'a_fazer' check (status in ('a_fazer','fazendo','feito')),
  concluido_em timestamptz,
  concluido_por uuid references public.profiles(id) on delete set null,
  observacao text,
  evidencia_url text,
  created_at timestamptz not null default now(),
  unique (unit_id, pop_id, periodo_ref)           -- evita duplicar o mesmo POP no mesmo período
);
create index pop_exec_idx on public.pop_execucoes (unit_id, departamento, status, data_prevista);

-- ───────────────────────── RLS ─────────────────────────
alter table public.cards enable row level security;
alter table public.card_eventos enable row level security;
alter table public.pops enable row level security;
alter table public.pop_execucoes enable row level security;

create policy cards_rw on public.cards for all to authenticated
  using (public.pode(unit_id, departamento)) with check (public.pode(unit_id, departamento));

create policy eventos_rw on public.card_eventos for all to authenticated
  using (public.pode(unit_id, departamento)) with check (public.pode(unit_id, departamento));

-- POPs (catálogo): todos com acesso ao módulo leem; só admin/master editam
create policy pops_read on public.pops for select to authenticated
  using (public.pode(unit_id, departamento));
create policy pops_write on public.pops for all to authenticated
  using (public.eh_admin_da(unit_id)) with check (public.eh_admin_da(unit_id));

create policy pop_exec_rw on public.pop_execucoes for all to authenticated
  using (public.pode(unit_id, departamento)) with check (public.pode(unit_id, departamento));

-- ───────────────────────── Seed: POPs do Financeiro (rio_verde) ─────────────────────────
insert into public.pops (unit_id, departamento, titulo, procedimento, frequencia, responsavel_sugerido, ordem) values
('rio_verde','financeiro','Enviar WhatsApp para alunos com parcelas vencendo no dia','Relatório / Financeiro / Parcela vencida.','diaria',null,1),
('rio_verde','financeiro','Ligar para alunos com parcelas vencidas que completam 5 dias','Relatório / Financeiro / Parcela vencida.','diaria',null,2),
('rio_verde','financeiro','Arquivar termos de acordo, rescisão e trancamento no ZapSign','Conferir se todos os termos foram lançados no sistema e verificar se foram assinados.','mensal',null,3),
('rio_verde','financeiro','Conferir e arquivar contratos de matrículas do mês anterior','Acessar o ZapSign com o relatório de matrículas do mês anterior; conferir junto ao gerente comercial se possuem e-mail e telefones cadastrados corretamente e assinatura no ZapSign.','mensal',null,4),
('rio_verde','financeiro','Conferir existência dos contratos ativos e desistentes no ZapSign','Relatório / Secretaria / Relatório de alunos / Filtrar pelo status.','mensal',null,5),
('rio_verde','financeiro','Ligação para alunos inadimplentes do mês anterior','Relatório / Financeiro / Parcelas vencidas. Ligar para todos os alunos e agendar nova data de pagamento.','mensal',null,6),
('rio_verde','financeiro','Ligação para alunos trancados inadimplentes','Relatório / Financeiro / Parcelas vencidas / Filtrar pelo status Trancado.','mensal',null,7),
('rio_verde','financeiro','Pós-venda com alunos matriculados no mês anterior','Relatório / Secretaria / Matrículas / Filtrar pelo mês anterior. Ligar com 3 perguntas: tem dúvidas sobre o contrato? está gostando das aulas? indicaria um amigo?','mensal',null,8),
('rio_verde','financeiro','Envio de cartas para alunos inadimplentes do mês anterior','Cartas / Carta 2.','mensal',null,9),
('rio_verde','financeiro','Separar contratos para enviar ao SPC','Entre os contratos desistentes, separar os que tinham maior frequência de aulas e pararam de frequentar.','mensal',null,10),
('rio_verde','financeiro','Criar pasta no Drive com lista de chamada e contratos a negativar','Tirar cópia da lista de chamada com assinatura do aluno a ser enviado carta e cópia dos contratos a serem negativados.','mensal',null,11),
('rio_verde','financeiro','Enviar WhatsApp e e-mail informando sobre a negativação','Enviar individualmente mensagem informativa sobre a negativação.','mensal',null,12);

-- Seed: POPs do Pedagógico e Encaminhamento (dos arquivos, como estão)
insert into public.pops (unit_id, departamento, titulo, procedimento, frequencia, dia_do_mes, responsavel_sugerido, ordem) values
('rio_verde','pedagogico','Impressão de certificados','Relatório / Secretaria / Alunos / Status Formado / Filtrar por período. Imprimir os certificados de curso gratuito e também dos alunos que solicitaram.','mensal',null,'João Vitor',1),
('rio_verde','pedagogico','Manutenção das máquinas do laboratório de Hardware','Garantir a qualidade das aulas.','mensal',null,'José Vitor',2),
('rio_verde','pedagogico','Padronização das máquinas do laboratório de Informática','Garantir a qualidade das aulas.','mensal',null,'José Vitor',3),
('rio_verde','pedagogico','Lançar vale-apostila no sistema','Garantir que o aluno não receba material em dobro.','semanal',null,'João Vitor',4),
('rio_verde','pedagogico','Enviar mensagem no grupo informando os alunos de suas aulas','Relatório / Secretaria / Relatório para torpedo.','diaria',null,'João Vitor / José Vitor',5),
('rio_verde','pedagogico','Mensagem no WhatsApp para alunos faltantes','Relatório / Secretaria / Relatório de faltantes.','diaria',null,'João Vitor / José Vitor',6),
('rio_verde','pedagogico','Mensagem nos grupos das turmas','Compartilhar materiais sobre a aula da semana nos grupos das turmas.','semanal',null,'João Vitor / José Vitor',7),
('rio_verde','encaminhamento','Atualizar mural de alunos aniversariantes','Relatório / Secretaria / Relatório de aniversariantes.','dia_fixo',1,null,1),
('rio_verde','encaminhamento','Atualizar mural de alunos encaminhados','Agência de Empregos / Relatório de encaminhamento / Período do mês anterior.','dia_fixo',1,null,2),
('rio_verde','encaminhamento','Atualizar vagas de emprego','Ligar para empresas parceiras e verificar novas vagas; diariamente atender as empresas no Instagram Emprega.','semanal',null,null,3),
('rio_verde','encaminhamento','Conferência dos documentos da agência','Arquivar em pastas separadas (virtuais p/ assinados online e física p/ físicos): normas de encaminhamento assinado, carta de confirmação de encaminhamento, termo de parceria das empresas e testemunho de encaminhamento.','mensal',null,null,4),
('rio_verde','encaminhamento','Criação de conteúdo com testemunhos de alunos encaminhados','Coletar o testemunho de todos os alunos encaminhados, editar e postar nas redes sociais, pedindo ao aluno que fale como a MULT Profissões o auxiliou na conquista da entrevista.','mensal',null,null,5),
('rio_verde','encaminhamento','Ligar para alunos cadastrados assim que surgir vaga no perfil','Agência de Empregos / Exibir vagas / Encaminhamento de candidato / Busca candidato.','semanal',null,null,6),
('rio_verde','encaminhamento','Fechar novas parcerias para a agência','Consulta em jornais ou sites de anúncio de vagas; contatar as empresas anunciantes e oferecer a parceria gratuitamente.','semanal',null,null,7),
('rio_verde','encaminhamento','Ligar para empresas parceiras e captar novas vagas','Agência de Encaminhamento / Exibir empresas / Ligar para todas e verificar a disponibilidade de vagas em aberto.','semanal',null,null,8);
