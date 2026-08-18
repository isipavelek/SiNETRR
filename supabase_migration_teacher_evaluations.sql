-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - CATALOGO DE ROLES Y COMENTARIOS DOCENTES
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- 1. Crear tabla para el catálogo de clasificaciones (roles escolares)
CREATE TABLE IF NOT EXISTS public.teacher_roles_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en teacher_roles_catalog
ALTER TABLE public.teacher_roles_catalog ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS "Allow public read/write on teacher_roles_catalog" ON public.teacher_roles_catalog;

-- Crear política amplia para desarrollo
CREATE POLICY "Allow public read/write on teacher_roles_catalog" ON public.teacher_roles_catalog 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Insertar roles base si no existen
INSERT INTO public.teacher_roles_catalog (name) VALUES 
    ('SPOT'), 
    ('Part Time'), 
    ('Full Time') 
ON CONFLICT (name) DO NOTHING;


-- 2. Crear tabla para comentarios y evaluaciones con control de visibilidad
CREATE TABLE IF NOT EXISTS public.teacher_evaluations_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    coordinator_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    visible_to_teacher BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en teacher_evaluations_comments
ALTER TABLE public.teacher_evaluations_comments ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS "Allow public read/write on teacher_evaluations_comments" ON public.teacher_evaluations_comments;

-- Crear política amplia para desarrollo
CREATE POLICY "Allow public read/write on teacher_evaluations_comments" ON public.teacher_evaluations_comments 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 3. Comentarios explicativos
COMMENT ON TABLE public.teacher_roles_catalog IS 'Catálogo de clasificaciones o roles escolares personalizados que pueden asignarse a los docentes.';
COMMENT ON TABLE public.teacher_evaluations_comments IS 'Comentarios y evaluaciones internas de los coordinadores para con los docentes, con visibilidad opcional para el propio docente.';
