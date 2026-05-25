-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - GESTIÓN DE PROYECTOS Y COMPRAS POR MATERIA
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- 1. Crear tabla de proyectos por materia
CREATE TABLE IF NOT EXISTS public.subject_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Activo' NOT NULL -- 'Activo', 'Finalizado', 'Suspendido'
);

-- Habilitar RLS en subject_projects
ALTER TABLE public.subject_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on subject_projects" ON public.subject_projects FOR ALL USING (true) WITH CHECK (true);

-- 2. Crear tabla de compras de materiales (pedidos)
CREATE TABLE IF NOT EXISTS public.material_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.subject_projects(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Contiene arreglo de materiales: [{name, quantity, unit, estimated_price, link}]
    justification TEXT,
    priority VARCHAR(50) DEFAULT 'Media' NOT NULL, -- 'Baja', 'Media', 'Alta'
    status VARCHAR(50) DEFAULT 'Pendiente' NOT NULL, -- 'Pendiente', 'Aceptado', 'En Proceso', 'Cerrado', 'Rechazado'
    coordination_notes TEXT,
    total_cost NUMERIC DEFAULT 0.0
);

-- Habilitar RLS en material_purchases
ALTER TABLE public.material_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on material_purchases" ON public.material_purchases FOR ALL USING (true) WITH CHECK (true);
