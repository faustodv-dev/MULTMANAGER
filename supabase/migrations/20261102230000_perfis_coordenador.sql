-- Perfis: adiciona "coordenador" (vê todas as telas operacionais, mas não gerencia usuários)
-- e atualiza public.pode para refletir os papéis. Admin segue com acesso total (inclui configurações).

alter table public.profiles drop constraint if exists profiles_papel_check;
alter table public.profiles add constraint profiles_papel_check check (papel in ('master','admin','coordenador','colaborador'));

create or replace function public.pode(u text, m text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ativo
      and (
        p.papel = 'master'
        or (p.unit_id = u and (
          p.papel = 'admin'
          or (p.papel = 'coordenador' and m <> 'configuracoes')
          or (p.papel = 'colaborador' and m = any(p.modulos))
        ))
      )
  );
$$;
