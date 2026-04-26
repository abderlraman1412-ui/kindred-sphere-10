-- 1) Extend app_role enum with 'assistant_admin'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant_admin';