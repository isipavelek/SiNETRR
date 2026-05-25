-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - GESTIÓN DE FOTOS DE HERRAMIENTAS Y DOCENTES
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- 1. Agregar columna de imagen al inventario de herramientas
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Agregar columna de foto al perfil del docente
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
