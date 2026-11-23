-- Config de disparos (anti-bloqueio) por unidade. Teto de conversas NOVAS/dia editável
-- pelo admin (não no código) + janela diurna de envio.
alter table public.units add column if not exists disparos jsonb;
-- Índice p/ contar rápido as novas já agendadas por dia (respeitar o teto).
create index if not exists idx_fila_novas on public.fila_mensagens (unit_id, agendado_para)
  where (metadata->>'conversa') = 'nova' and status <> 'cancelado';
