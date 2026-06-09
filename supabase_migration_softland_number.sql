-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - ADD SOFTLAND NUMBER TO PURCHASES
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

ALTER TABLE public.material_purchases 
ADD COLUMN IF NOT EXISTS softland_number VARCHAR(100);
