-- Add new financial fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS enrollment_installments integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS installment_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS material_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS material_installments integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS uniform_installments integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS first_contact_date timestamp with time zone DEFAULT now();

-- Update payment_method to support new options
-- Payment method can now be: 'a_vista', 'cartao_credito', 'carne_boleto'
COMMENT ON COLUMN public.leads.payment_method IS 'Payment method: a_vista, cartao_credito, carne_boleto';