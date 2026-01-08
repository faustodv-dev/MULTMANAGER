-- Create enum for lead stages in the educational funnel
CREATE TYPE public.lead_stage AS ENUM (
  'novo',
  'contato_inicial',
  'qualificacao',
  'apresentacao',
  'negociacao',
  'matricula',
  'perdido'
);

-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('ativo', 'inativo', 'convertido', 'perdido');

-- Create table for media sources
CREATE TABLE public.media_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert all media sources
INSERT INTO public.media_sources (name) VALUES
  ('Panfleto'),
  ('Rádio'),
  ('Indicação'),
  ('Jornal'),
  ('TORPEDO'),
  ('CARRO DE SOM'),
  ('MALA DIRETA'),
  ('FACHADA'),
  ('MACRO'),
  ('Renovação'),
  ('TV'),
  ('Banco De Dados'),
  ('Cartaz'),
  ('Orientador externo'),
  ('Visita Antiga'),
  ('Site'),
  ('Raspadinha'),
  ('Corporativo'),
  ('Curso Gratis'),
  ('Telemarketing'),
  ('Merito Estudantil'),
  ('Ação Social'),
  ('Lista Telefônica'),
  ('Cartas'),
  ('ALUNOS'),
  ('VALE COMPRAS'),
  ('FAIXA DE RUA'),
  ('STREET'),
  ('CUPOM ESCOLA'),
  ('PARCERIA'),
  ('PLACA'),
  ('Transferencia'),
  ('FACEBOOK'),
  ('Ação Externa'),
  ('WHATSAPP'),
  ('GOOGLE'),
  ('TCP'),
  ('INSTAGRAM'),
  ('TIKTOK'),
  ('INSTAGRAM PAGO'),
  ('INSTAGRAM ORGANICO'),
  ('INSTAGRAM PARCERIA');

-- Enable RLS for media_sources
ALTER TABLE public.media_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view media sources"
ON public.media_sources FOR SELECT
USING (true);

CREATE POLICY "Admins can manage media sources"
ON public.media_sources FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  cpf TEXT,
  birth_date DATE,
  
  -- Educational specific fields
  course_interest TEXT,
  education_level TEXT,
  has_diploma BOOLEAN DEFAULT false,
  
  -- Lead source and tracking
  media_source_id UUID REFERENCES public.media_sources(id),
  campaign TEXT,
  
  -- Funnel stage
  stage lead_stage NOT NULL DEFAULT 'novo',
  status lead_status NOT NULL DEFAULT 'ativo',
  
  -- Financial info from quote
  quote_value DECIMAL(10,2),
  discount_percent DECIMAL(5,2),
  final_value DECIMAL(10,2),
  
  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id),
  department_id UUID REFERENCES public.departments(id),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  converted_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  
  -- Next follow-up
  next_contact_date TIMESTAMP WITH TIME ZONE,
  
  -- Notes
  notes TEXT
);

-- Enable RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads
CREATE POLICY "Authenticated users can view leads"
ON public.leads FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create leads"
ON public.leads FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update assigned leads or admins/managers"
ON public.leads FOR UPDATE
USING (
  assigned_to = auth.uid() OR 
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins can delete leads"
ON public.leads FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create lead activities table for tracking interactions
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  activity_type TEXT NOT NULL, -- 'call', 'email', 'whatsapp', 'meeting', 'note', 'stage_change'
  description TEXT NOT NULL,
  old_stage lead_stage,
  new_stage lead_stage,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for lead_activities
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activities"
ON public.lead_activities FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create activities"
ON public.lead_activities FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at on leads
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX idx_leads_media_source ON public.leads(media_source_id);
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);

-- Function to create a user directly (admin only)
-- This will be called from an edge function
CREATE OR REPLACE FUNCTION public.admin_create_user_profile(
  _user_id UUID,
  _full_name TEXT,
  _department_id UUID DEFAULT NULL,
  _role app_role DEFAULT 'employee'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create users';
  END IF;
  
  -- Insert profile (handle if already exists)
  INSERT INTO public.profiles (id, full_name, department_id)
  VALUES (_user_id, _full_name, _department_id)
  ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    department_id = EXCLUDED.department_id;
  
  -- Insert/update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  
  RETURN _user_id;
END;
$$;