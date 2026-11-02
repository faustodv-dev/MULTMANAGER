-- Cada unidade define as próprias regras do agente de IA (editável pelo admin da unidade).
alter table public.units add column if not exists instrucoes_agente text;
