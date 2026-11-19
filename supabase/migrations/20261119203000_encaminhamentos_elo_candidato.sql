-- Fecho da agência: elo candidato↔encaminhamento + histórico manual (antigos do MULT).
-- candidato_id liga o encaminhamento à ficha; empresa_nome/cargo_nome denormalizam
-- para exibir o histórico sem join (e guardar os lançamentos manuais).
alter table public.encaminhamentos add column if not exists candidato_id uuid;
alter table public.encaminhamentos add column if not exists empresa_nome text;
alter table public.encaminhamentos add column if not exists cargo_nome text;
alter table public.encaminhamentos add column if not exists manual boolean not null default false;
create index if not exists idx_enc_candidato on public.encaminhamentos(candidato_id);
