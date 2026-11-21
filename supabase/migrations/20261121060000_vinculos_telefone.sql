-- Vínculo manual aluno↔telefone (tela Atendimento).
-- Quando o número do WhatsApp não bate com o campo telefone do MULT (chip novo,
-- celular do aluno em vez do responsável, etc.), um humano amarra o número a um
-- código de aluno. O atendente consulta esta tabela ANTES do buscar_telefone e
-- assume a identidade — vale para a conversa atual e para os próximos contatos
-- daquele número. Visão por aluno (dossiê) já agrupa cards por cod_alu.
create table if not exists public.vinculos_telefone (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null,
  telefone text not null,                 -- só dígitos (DDI+DDD+número)
  cod_alu text not null,
  grupo jsonb,                            -- snapshot {nome_responsavel, cpf_responsavel, alunos:[{cod_alu,nome,matriculas}]}
  nome_aluno text,
  criado_por uuid,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  unique (unit_id, telefone)
);
create index if not exists idx_vinculos_unit_tel on public.vinculos_telefone(unit_id, telefone);

-- Acesso só pelo backend (service role, que ignora RLS). O cliente nunca lê esta tabela.
alter table public.vinculos_telefone enable row level security;
