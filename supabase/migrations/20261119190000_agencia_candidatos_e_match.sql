-- Etapa 1 da Agência: ficha de candidato (perfil profissional) + campos estruturados
-- de match na vaga. O match (Etapa 2) roda só no Supabase, comparando os mesmos
-- critérios nas duas fichas — sem tocar a escola (ponte).
create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null,
  cod_alu text,
  nome text not null,
  telefone text,
  nascimento date,
  sexo text,
  area text,
  turnos text[] not null default '{}',
  escolaridade text,
  experiencia boolean not null default false,
  experiencia_area text,
  cnh text,
  cursos_mult text,
  pretensao text,
  bairro text,
  observacoes text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists idx_candidatos_unit on public.candidatos(unit_id);
create index if not exists idx_candidatos_cod on public.candidatos(unit_id, cod_alu);
alter table public.candidatos enable row level security;

-- Vaga ganha os mesmos critérios do dicionário compartilhado.
alter table public.vagas add column if not exists area text;
alter table public.vagas add column if not exists turnos text[] not null default '{}';
alter table public.vagas add column if not exists escolaridade_min text;
alter table public.vagas add column if not exists cnh_exigida text;
