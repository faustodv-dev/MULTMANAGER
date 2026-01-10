-- Add payment tracking fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS enrollment_fee_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS enrollment_fee_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_installment_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS first_installment_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS uniform_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS uniform_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL;

-- Add comment for payment_method values
COMMENT ON COLUMN public.leads.payment_method IS 'Payment method: cartao, pix, dinheiro';