-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - MÓDULO DE EVENTOS Y ENTREGAS DE PROYECTOS
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- 1. Tabla de Eventos
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name VARCHAR(255) NOT NULL,
    date DATE,
    status VARCHAR(50) DEFAULT 'Planificado' NOT NULL -- 'Planificado', 'Activo', 'Finalizado'
);

-- Habilitar RLS en events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on events" ON public.events FOR ALL USING (true) WITH CHECK (true);

-- Agregar columna event_id a la tabla subject_projects
ALTER TABLE public.subject_projects ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- 2. Tabla de Plantillas de Muestras (definidas por Coordinación por Evento)
CREATE TABLE IF NOT EXISTS public.event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL, -- Ej: 'Póster de la Muestra', 'Informe de Muestra'
    description TEXT,
    template_url TEXT -- Link opcional a un archivo de plantilla
);

-- Habilitar RLS en event_templates
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on event_templates" ON public.event_templates FOR ALL USING (true) WITH CHECK (true);

-- 3. Tabla de Entregas de Documentos por Proyecto
CREATE TABLE IF NOT EXISTS public.project_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    project_id UUID REFERENCES public.subject_projects(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES public.event_templates(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL, -- Link al documento entregado
    comments TEXT,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

-- Habilitar RLS en project_submissions
ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on project_submissions" ON public.project_submissions FOR ALL USING (true) WITH CHECK (true);

-- 4. Tabla de Galería de Imágenes y Avances de Proyectos
CREATE TABLE IF NOT EXISTS public.project_gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    project_id UUID REFERENCES public.subject_projects(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    progress_description TEXT,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

-- Habilitar RLS en project_gallery
ALTER TABLE public.project_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on project_gallery" ON public.project_gallery FOR ALL USING (true) WITH CHECK (true);

-- 5. Insertar Eventos Iniciales de Semilla
INSERT INTO public.events (name, date, status) 
VALUES 
('MAPE 2026', '2026-11-12', 'Activo'),
('Día de la Educación Roberto Rocca', '2026-10-15', 'Planificado')
ON CONFLICT DO NOTHING;
