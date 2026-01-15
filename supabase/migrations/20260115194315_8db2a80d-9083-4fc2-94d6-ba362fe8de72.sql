-- Create school_units table
CREATE TABLE public.school_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert initial units
INSERT INTO public.school_units (name, city) VALUES 
  ('Rio Verde', 'Rio Verde'),
  ('Aparecida de Goiânia', 'Aparecida de Goiânia');

-- Enable RLS
ALTER TABLE public.school_units ENABLE ROW LEVEL SECURITY;

-- Anyone can view active units
CREATE POLICY "Anyone can view active units" 
ON public.school_units 
FOR SELECT 
USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage units
CREATE POLICY "Admins can manage units" 
ON public.school_units 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add unit_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN unit_id UUID REFERENCES public.school_units(id);

-- Add unit_id to leads
ALTER TABLE public.leads 
ADD COLUMN unit_id UUID REFERENCES public.school_units(id);

-- Add unit_id to tasks
ALTER TABLE public.tasks 
ADD COLUMN unit_id UUID REFERENCES public.school_units(id);

-- Create trigger for updated_at on school_units
CREATE TRIGGER update_school_units_updated_at
BEFORE UPDATE ON public.school_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();