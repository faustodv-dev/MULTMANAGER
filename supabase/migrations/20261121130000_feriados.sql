-- Feriados e fechamentos (controle de "a escola está aberta hoje?").
-- O agente lê esta tabela para: responder "funciona hoje?" e NÃO oferecer reposição
-- em feriado. Nacional = unit_id null (vale p/ todas). Municipal/recesso = por unidade.
-- Nacionais fixos entram como recorrentes (repetem todo ano no mesmo dd/mm);
-- móveis (Carnaval, Sexta-feira Santa, Corpus Christi) entram com data exata por ano.
create table if not exists public.feriados (
  id uuid primary key default gen_random_uuid(),
  unit_id text,                                 -- null = nacional (vale p/ todas as unidades)
  escopo text not null default 'municipal',     -- nacional | municipal | recesso
  nome text not null,
  data date,                                    -- data exata (quando não recorrente)
  dia smallint,                                 -- recorrente: dia do mês
  mes smallint,                                 -- recorrente: mês
  recorrente boolean not null default false,    -- repete todo ano no mesmo dd/mm
  criado_por uuid,
  criado_em timestamptz not null default now()
);
create index if not exists idx_feriados_unit on public.feriados(unit_id);
create index if not exists idx_feriados_data on public.feriados(data);

-- Acesso só pelo backend (service role, que ignora RLS). O cliente lê via API.
alter table public.feriados enable row level security;

-- Seed dos feriados nacionais (só se ainda não houver nenhum nacional).
do $$
begin
  if not exists (select 1 from public.feriados where escopo = 'nacional') then
    insert into public.feriados (escopo, nome, dia, mes, recorrente) values
      ('nacional','Confraternização Universal',1,1,true),
      ('nacional','Tiradentes',21,4,true),
      ('nacional','Dia do Trabalho',1,5,true),
      ('nacional','Independência do Brasil',7,9,true),
      ('nacional','Nossa Senhora Aparecida',12,10,true),
      ('nacional','Finados',2,11,true),
      ('nacional','Proclamação da República',15,11,true),
      ('nacional','Dia da Consciência Negra',20,11,true),
      ('nacional','Natal',25,12,true);
    insert into public.feriados (escopo, nome, data, recorrente) values
      ('nacional','Carnaval','2026-02-17',false),
      ('nacional','Sexta-feira Santa','2026-04-03',false),
      ('nacional','Corpus Christi','2026-06-04',false),
      ('nacional','Carnaval','2027-02-09',false),
      ('nacional','Sexta-feira Santa','2027-03-26',false),
      ('nacional','Corpus Christi','2027-05-27',false);
  end if;
end $$;
