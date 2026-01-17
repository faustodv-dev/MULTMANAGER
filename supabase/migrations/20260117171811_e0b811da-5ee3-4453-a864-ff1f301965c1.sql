-- Add 'unit_admin' to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'unit_admin';

-- Update the has_role function to be aware of the new role
-- (function already exists and works with the enum, so no changes needed)

-- Update admin_create_user_profile to handle unit_admin (optional, but good to have)
-- The existing function will automatically work with the new role value