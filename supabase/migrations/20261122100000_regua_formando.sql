-- Régua de Formando: funil 80%→100% que roda em paralelo à régua de faltantes,
-- pegando carona no cálculo de frequência. Config por unidade (mesmo padrão de regua_*).
alter table public.units add column if not exists regua_formando jsonb;
