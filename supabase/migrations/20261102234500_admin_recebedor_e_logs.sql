-- Admin da unidade pode editar o recebedor (CNPJ/razão social/Pix); só o master muda a baixa automática.
create or replace function public.proteger_unidade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_master() then
    if new.baixa_automatica is distinct from old.baixa_automatica or new.id is distinct from old.id then
      raise exception 'Somente o master altera a baixa automática.';
    end if;
  end if;
  return new;
end $$;

-- Logs (registro_acoes): master vê tudo; admin vê os da própria unidade (ex.: Simulador).
drop policy if exists registro_master on public.registro_acoes;
create policy registro_leitura on public.registro_acoes for select to authenticated
  using (public.eh_master() or (unit_id is not null and public.eh_admin_da(unit_id)));
