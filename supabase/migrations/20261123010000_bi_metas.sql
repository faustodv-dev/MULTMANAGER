-- BI de Metas (Fase 3): snapshot diário leve + metas digitadas.
-- O front NUNCA lê estas tabelas direto; vai sempre pela API (service role),
-- então habilitamos RLS sem policy (nega acesso direto; service role ignora RLS).

-- Um retrato por unidade/dia. métricas em jsonb para escalar sem migração
-- (hoje: frequencia_media, matriculas_ativas, formandos_80, evasao_*; depois:
--  inadimplencia, encaminhados, novas_mes, …).
create table if not exists public.bi_snapshots (
  id bigint generated always as identity primary key,
  unit_id text not null,
  data date not null,
  metricas jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  unique (unit_id, data)
);
create index if not exists idx_bi_snapshots_unit_data on public.bi_snapshots (unit_id, data desc);
alter table public.bi_snapshots enable row level security;

-- Metas digitadas pelo master: alvo por unidade, métrica e período (yyyy-mm).
create table if not exists public.metas (
  id bigint generated always as identity primary key,
  unit_id text not null,
  metrica text not null,
  periodo text not null,
  alvo numeric not null,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  unique (unit_id, metrica, periodo)
);
create index if not exists idx_metas_unit_periodo on public.metas (unit_id, periodo);
alter table public.metas enable row level security;
