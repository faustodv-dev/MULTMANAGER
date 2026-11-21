-- Mural de novidades/avisos internos (equipe), publicado pelo master dentro do sistema.
-- Aparece no Início, no sino do topo e — quando "importante" — num modal no login.
-- Confirmação de leitura nominal por usuário (novidades_leituras).
create table if not exists public.novidades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  corpo text not null default '',
  tipo text not null default 'novidade',       -- novidade | aviso | importante
  fixado boolean not null default false,
  unit_id text,                                 -- null = todas as unidades
  anexo_url text,
  publicado boolean not null default true,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_novidades_pub on public.novidades(publicado, criado_em desc);

create table if not exists public.novidades_leituras (
  novidade_id uuid not null references public.novidades(id) on delete cascade,
  user_id uuid not null,
  lido_em timestamptz not null default now(),
  primary key (novidade_id, user_id)
);

alter table public.novidades enable row level security;
alter table public.novidades_leituras enable row level security;

-- Clientes podem LER as novidades publicadas (necessário p/ o realtime do sino).
-- Escrita e leitura/gravação de leituras são feitas só pelo backend (service role).
drop policy if exists novidades_leitura on public.novidades;
create policy novidades_leitura on public.novidades for select to authenticated using (publicado = true);

-- Realtime: o sino atualiza sozinho quando o master publica.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'novidades'
  ) then
    execute 'alter publication supabase_realtime add table public.novidades';
  end if;
end $$;
