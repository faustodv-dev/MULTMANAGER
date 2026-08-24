ALTER TYPE public.lead_stage RENAME TO lead_stage_old;

CREATE TYPE public.lead_stage AS ENUM (
  'assuntos_pendentes',
  'pendencia_eja',
  'pendencia_online',
  'pendencia_tecnico',
  'desistentes',
  'rescisao_cancelamento',
  'finalizado'
);

ALTER TABLE public.leads ALTER COLUMN stage DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN stage TYPE public.lead_stage
  USING (CASE stage::text
    WHEN 'matricula' THEN 'finalizado'
    WHEN 'perdido' THEN 'desistentes'
    ELSE 'assuntos_pendentes'
  END)::public.lead_stage;

ALTER TABLE public.leads ALTER COLUMN stage SET DEFAULT 'assuntos_pendentes'::public.lead_stage;

ALTER TABLE public.lead_activities
  ALTER COLUMN old_stage TYPE public.lead_stage
  USING (CASE old_stage::text
    WHEN 'matricula' THEN 'finalizado'
    WHEN 'perdido' THEN 'desistentes'
    WHEN NULL THEN NULL
    ELSE 'assuntos_pendentes'
  END)::public.lead_stage;

ALTER TABLE public.lead_activities
  ALTER COLUMN new_stage TYPE public.lead_stage
  USING (CASE new_stage::text
    WHEN 'matricula' THEN 'finalizado'
    WHEN 'perdido' THEN 'desistentes'
    WHEN NULL THEN NULL
    ELSE 'assuntos_pendentes'
  END)::public.lead_stage;

DROP TYPE public.lead_stage_old;