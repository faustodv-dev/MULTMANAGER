-- Régua de boletim mensal (texto, dia 01, pela fila). Config por unidade em jsonb,
-- no mesmo padrão das demais réguas (regua, regua_faltantes, regua_aviso, regua_formando).
alter table public.units add column if not exists regua_boletim jsonb;
