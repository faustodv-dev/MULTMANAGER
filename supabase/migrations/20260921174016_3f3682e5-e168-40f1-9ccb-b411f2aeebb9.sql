
-- ========== STUDENTS ==========
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  unit_id uuid REFERENCES public.school_units(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view students of their unit"
ON public.students FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR unit_id IS NULL
  OR unit_id = (SELECT profiles.unit_id FROM public.profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Users can create students in their unit"
ON public.students FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR unit_id IS NULL
  OR unit_id = (SELECT profiles.unit_id FROM public.profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Users can update students of their unit"
ON public.students FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR unit_id = (SELECT profiles.unit_id FROM public.profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Admins can delete students"
ON public.students FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'unit_admin'::app_role)
      AND unit_id = (SELECT profiles.unit_id FROM public.profiles WHERE profiles.id = auth.uid()))
  OR created_by = auth.uid()
);

CREATE UNIQUE INDEX students_unit_code_unique
  ON public.students (unit_id, lower(code)) WHERE code IS NOT NULL;
CREATE INDEX students_name_idx ON public.students (lower(name));

CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== LINK LEADS / ACTIVITIES TO STUDENTS ==========
ALTER TABLE public.leads
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE INDEX leads_student_id_idx ON public.leads (student_id);

ALTER TABLE public.lead_activities
  ADD COLUMN student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE INDEX lead_activities_student_id_idx ON public.lead_activities (student_id);

-- leads.phone becomes optional for pedagogical records
ALTER TABLE public.leads ALTER COLUMN phone DROP NOT NULL;

-- ========== TASK COMPLETION HISTORY ==========
CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  process_id uuid REFERENCES public.processes(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.school_units(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  task_title text NOT NULL,
  cycle_key text,
  notes text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view completions of their unit"
ON public.task_completions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR unit_id IS NULL
  OR unit_id = (SELECT profiles.unit_id FROM public.profiles WHERE profiles.id = auth.uid())
);

CREATE POLICY "Users can record completions"
ON public.task_completions FOR INSERT TO authenticated
WITH CHECK (completed_by = auth.uid() OR completed_by IS NULL);

CREATE INDEX task_completions_completed_at_idx ON public.task_completions (completed_at DESC);
CREATE INDEX task_completions_task_idx ON public.task_completions (task_id);

-- ========== TASK CYCLE MARKER ==========
ALTER TABLE public.tasks ADD COLUMN cycle_key text;
ALTER TABLE public.tasks ADD COLUMN last_completed_at timestamptz;
