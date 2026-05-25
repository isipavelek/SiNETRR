-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - GESTIÓN DE FOTOS DE HERRAMIENTAS Y DOCENTES
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- 1. Agregar columna de imagen al inventario de herramientas
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Agregar columna de foto al perfil del docente
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;


-- ====================================================================
-- POLÍTICAS DE ALMACENAMIENTO (SUPABASE STORAGE)
-- Ejecutar si da error "new row violates row-level security policy" al subir fotos
-- ====================================================================

-- Permitir subir archivos a la carpeta 'profiles'
CREATE POLICY "Permitir subir fotos de perfil" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'profiles');

-- Permitir subir archivos a la carpeta 'tools'
CREATE POLICY "Permitir subir fotos de herramientas" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'tools');

-- Permitir lectura pública de ambas carpetas
CREATE POLICY "Lectura publica de fotos de perfil" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'profiles');

CREATE POLICY "Lectura publica de fotos de herramientas" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = 'tools');
