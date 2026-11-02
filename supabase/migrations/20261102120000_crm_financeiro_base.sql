-- CRM pedagógico/financeiro MULT — base (projeto Supabase novo)

-- ============ Unidades e acesso ============
create table public.units (
  id text primary key,                         -- mesmo código da ponte (ex.: rio_verde)
  name text not null,
  whatsapp_status text default 'disconnected',
  whatsapp_number text,
  agente_ativo boolean not null default true,  -- IA responde nesta unidade
  baixa_automatica boolean not null default false, -- false = modo sombra
  asaas_conta text,                            -- identifica a conta Asaas (unidades podem compartilhar)
  created_at timestamptz not null default now()
);

-- Chaves por unidade (só o servidor lê)
create table public.unit_secrets (
  unit_id text primary key references public.units(id) on delete cascade,
  asaas_api_key text,
  gemini_api_key text,
  groq_api_key text,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null default '',
  papel text not null default 'colaborador' check (papel in ('master', 'admin', 'colaborador')),
  unit_id text references public.units(id),
  departamento text,
  modulos text[] not null default '{}',        -- telas liberadas: atendimento, comprovantes, financeiro, configuracoes
  ativo boolean not null default false,
  created_at timestamptz not null default now()
);

-- E-mails que já nascem como master ao criar a conta
create table public.masters_autorizados (email text primary key);
insert into public.masters_autorizados values ('faustodv@gmail.com');

create or replace function public.criar_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome, papel, ativo, modulos)
  values (
    new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'nome', ''),
    case when exists (select 1 from public.masters_autorizados m where m.email = lower(new.email)) then 'master' else 'colaborador' end,
    exists (select 1 from public.masters_autorizados m where m.email = lower(new.email)),
    case when exists (select 1 from public.masters_autorizados m where m.email = lower(new.email))
      then array['atendimento','comprovantes','financeiro','configuracoes'] else '{}' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.criar_profile();

create or replace function public.eh_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'master' and ativo)
$$;

create or replace function public.minha_unidade() returns text
language sql stable security definer set search_path = public as $$
  select unit_id from profiles where id = auth.uid() and ativo
$$;

create or replace function public.eh_admin_da(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and ativo and (papel = 'master' or (papel = 'admin' and unit_id = u)))
$$;

-- Pode ver dados da unidade u no módulo m
create or replace function public.pode(u text, m text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p where p.id = auth.uid() and p.ativo
      and (p.papel = 'master' or (p.unit_id = u and (p.papel = 'admin' or m = any(p.modulos))))
  )
$$;

-- ============ WhatsApp ============
create table public.whatsapp_sessions (
  id text primary key,
  unit_id text not null,
  data jsonb,
  updated_at timestamptz not null default now()
);

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id),
  telefone text not null,
  remote_jid text,
  nome_contato text,
  status text not null default 'ia' check (status in ('ia', 'aguardando_humano', 'humano', 'encerrada')),
  motivo_humano text,
  atribuido_a uuid references public.profiles(id),
  cpf_responsavel text,
  nome_responsavel text,
  cod_alus text[] not null default '{}',
  identidade_confirmada boolean not null default false,
  contexto jsonb not null default '{}',        -- memória do agente (candidatos, aluno em foco etc.)
  nao_lidas int not null default 0,
  ultima_mensagem text,
  ultimo_contato timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (unit_id, telefone)
);
create index conversas_unit_ultimo on public.conversas (unit_id, ultimo_contato desc);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  unit_id text not null,
  direcao text not null check (direcao in ('in', 'out')),
  autor text not null check (autor in ('contato', 'ia', 'humano', 'sistema')),
  texto text,
  midia_path text,
  midia_tipo text,
  midia_nome text,
  wa_message_id text,
  enviado_por uuid references public.profiles(id),
  status_envio text,
  criado_em timestamptz not null default now()
);
create index mensagens_conversa on public.mensagens (conversa_id, criado_em);
create unique index mensagens_wa_id on public.mensagens (unit_id, wa_message_id) where wa_message_id is not null;

-- ============ Comprovantes ============
create table public.comprovantes (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id),
  conversa_id uuid references public.conversas(id) on delete set null,
  mensagem_id uuid references public.mensagens(id) on delete set null,
  telefone text not null,
  remetente_nome text,
  arquivo_path text,
  arquivo_nome text,
  mime text,
  hash_arquivo text,
  recebido_em timestamptz not null default now(),
  status text not null default 'recebido' check (status in (
    'recebido', 'analisando', 'nao_e_comprovante', 'aguardando_aluno', 'divergente', 'duplicado',
    'sombra_ok', 'baixado', 'aguardando_humano', 'resolvido_manual', 'rejeitado')),
  extraido jsonb,                 -- leitura da IA: valor, data, tipo, end_to_end, pagador, recebedor
  valor_centavos int,
  data_pagamento date,
  end_to_end_id text,
  recebedor_ok boolean,
  extrato_conferido boolean,      -- Pix encontrado no extrato do Asaas
  extrato_ref text,
  cod_alus text[] not null default '{}',
  cod_pars int[] not null default '{}',
  ponte_resultado jsonb,
  observacao text,
  resolvido_por uuid references public.profiles(id),
  resolvido_em timestamptz
);
create index comprovantes_unit_data on public.comprovantes (unit_id, recebido_em desc);
create unique index comprovantes_e2e on public.comprovantes (unit_id, end_to_end_id)
  where end_to_end_id is not null and status not in ('rejeitado', 'nao_e_comprovante');
create index comprovantes_hash on public.comprovantes (unit_id, hash_arquivo);

-- ============ Fila de atendimento humano ============
create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id),
  conversa_id uuid references public.conversas(id) on delete cascade,
  comprovante_id uuid references public.comprovantes(id) on delete cascade,
  tipo text not null check (tipo in ('atendimento', 'comprovante', 'erro')),
  motivo text not null,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid references public.profiles(id)
);
create index pendencias_abertas on public.pendencias (unit_id, criado_em desc) where resolvido_em is null;

-- ============ Registro de chamadas à ponte / IA ============
create table public.registro_acoes (
  id bigint generated always as identity primary key,
  unit_id text,
  conversa_id uuid,
  tipo text not null,          -- ponte, ia, asaas, gateway
  acao text not null,
  ok boolean not null,
  duracao_ms int,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);
create index registro_acoes_data on public.registro_acoes (criado_em desc);

-- ============ RLS ============
alter table public.units enable row level security;
alter table public.unit_secrets enable row level security;
alter table public.profiles enable row level security;
alter table public.masters_autorizados enable row level security;
alter table public.whatsapp_sessions enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
alter table public.comprovantes enable row level security;
alter table public.pendencias enable row level security;
alter table public.registro_acoes enable row level security;
-- unit_secrets, masters_autorizados e whatsapp_sessions: sem políticas (só service role)

create policy units_ler on public.units for select to authenticated
  using (public.eh_master() or id = public.minha_unidade());
create policy units_master on public.units for all to authenticated
  using (public.eh_master()) with check (public.eh_master());
create policy units_admin_editar on public.units for update to authenticated
  using (public.eh_admin_da(id)) with check (public.eh_admin_da(id));

create policy profiles_ler on public.profiles for select to authenticated
  using (id = auth.uid() or public.eh_master() or (unit_id is not null and public.eh_admin_da(unit_id)));
create policy profiles_admin on public.profiles for update to authenticated
  using (public.eh_master() or (unit_id is not null and public.eh_admin_da(unit_id) and papel <> 'master'))
  with check (public.eh_master() or (unit_id is not null and public.eh_admin_da(unit_id) and papel <> 'master'));

create policy conversas_ler on public.conversas for select to authenticated using (public.pode(unit_id, 'atendimento'));
create policy conversas_editar on public.conversas for update to authenticated
  using (public.pode(unit_id, 'atendimento')) with check (public.pode(unit_id, 'atendimento'));

create policy mensagens_ler on public.mensagens for select to authenticated using (public.pode(unit_id, 'atendimento'));

create policy comprovantes_ler on public.comprovantes for select to authenticated
  using (public.pode(unit_id, 'comprovantes') or public.pode(unit_id, 'financeiro'));
create policy comprovantes_editar on public.comprovantes for update to authenticated
  using (public.pode(unit_id, 'comprovantes')) with check (public.pode(unit_id, 'comprovantes'));

create policy pendencias_ler on public.pendencias for select to authenticated
  using (public.pode(unit_id, 'atendimento') or public.pode(unit_id, 'comprovantes'));
create policy pendencias_editar on public.pendencias for update to authenticated
  using (public.pode(unit_id, 'atendimento') or public.pode(unit_id, 'comprovantes'))
  with check (public.pode(unit_id, 'atendimento') or public.pode(unit_id, 'comprovantes'));

create policy registro_master on public.registro_acoes for select to authenticated using (public.eh_master());

-- Colaborador não pode se promover: só master/admin alteram papel, unidade e módulos
create or replace function public.proteger_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.eh_master() then return new; end if;
  if new.papel = 'master' and old.papel <> 'master' then raise exception 'Somente o master cria outro master'; end if;
  if not public.eh_admin_da(coalesce(old.unit_id, '')) then
    if new.papel <> old.papel or new.unit_id is distinct from old.unit_id or new.modulos <> old.modulos or new.ativo <> old.ativo then
      raise exception 'Sem permissão para alterar acesso';
    end if;
  end if;
  if new.unit_id is distinct from old.unit_id then raise exception 'Somente o master troca a unidade'; end if;
  return new;
end $$;
create trigger proteger_profile before update on public.profiles for each row execute function public.proteger_profile();

-- ============ Storage (arquivos recebidos e enviados) ============
insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp-midia', 'whatsapp-midia', false, 15728640)
on conflict (id) do nothing;

create policy midia_ler on storage.objects for select to authenticated
  using (bucket_id = 'whatsapp-midia' and (public.eh_master() or (storage.foldername(name))[1] = public.minha_unidade()));

-- ============ Realtime ============
alter publication supabase_realtime add table public.conversas, public.mensagens, public.comprovantes, public.pendencias;

-- ============ Dados iniciais ============
insert into public.units (id, name, asaas_conta) values
  ('rio_verde', 'MULT Rio Verde - Popular', 'franchising_26436081000160');

-- Funções de gatilho não são chamáveis pela API; as auxiliares só por usuários logados
revoke execute on function public.criar_profile() from public, anon, authenticated;
revoke execute on function public.proteger_profile() from public, anon, authenticated;
revoke execute on function public.eh_master() from public, anon;
revoke execute on function public.minha_unidade() from public, anon;
revoke execute on function public.eh_admin_da(text) from public, anon;
revoke execute on function public.pode(text, text) from public, anon;
grant execute on function public.eh_master() to authenticated;
grant execute on function public.minha_unidade() to authenticated;
grant execute on function public.eh_admin_da(text) to authenticated;
grant execute on function public.pode(text, text) to authenticated;

-- Trava curta por conversa: só uma execução do agente por vez
alter table public.conversas add column processando_ate timestamptz;
create or replace function public.travar_conversa(p_id uuid, p_segundos int default 55) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update conversas set processando_ate = now() + make_interval(secs => p_segundos)
   where id = p_id and (processando_ate is null or processando_ate < now())
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke execute on function public.travar_conversa(uuid, int) from public, anon, authenticated;

-- Dados de recebimento para validar comprovantes
alter table public.units
  add column pix_chave text,
  add column recebedor_documento text,
  add column recebedor_nome text,
  add column atendimento_humano text;
update public.units set pix_chave = '26.436.081/0001-60', recebedor_documento = '26436081000160',
  recebedor_nome = 'MULT PROFISSOES FRANCHISING' where id = 'rio_verde';

-- Só o master liga a baixa automática ou troca o CNPJ recebedor
create or replace function public.proteger_unidade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_master() then
    if new.baixa_automatica is distinct from old.baixa_automatica or new.id is distinct from old.id
       or new.recebedor_documento is distinct from old.recebedor_documento then
      raise exception 'Somente o master altera baixa automática e recebedor';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.proteger_unidade() from public, anon, authenticated;
create trigger proteger_unidade before update on public.units for each row execute function public.proteger_unidade();
