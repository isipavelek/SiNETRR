-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - SEGUIMIENTO INTERNO DE DOCENTES
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.teacher_followups (
    teacher_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    classification VARCHAR(50) DEFAULT 'SPOT' NOT NULL, -- 'SPOT', 'FULL TIME', 'ESPECIALISTA'
    performance_status VARCHAR(50) DEFAULT 'Conforme' NOT NULL, -- 'Acciones para mejorar', 'Conforme'
    notes TEXT DEFAULT '' NOT NULL,
    checklist JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of { id: string, text: string, completed: boolean }
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en teacher_followups
ALTER TABLE public.teacher_followups ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS "Allow public read/write on teacher_followups" ON public.teacher_followups;

-- Crear política amplia para desarrollo
CREATE POLICY "Allow public read/write on teacher_followups" ON public.teacher_followups 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

COMMENT ON TABLE public.teacher_followups IS 'Información interna y de carácter confidencial para el seguimiento de los docentes por parte de coordinadores y gerentes.';
