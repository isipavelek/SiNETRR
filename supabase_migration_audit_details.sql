-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - DETALLES DE AUDITORÍAS 5S
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- Agregar columna para guardar el desglose detallado de las 30 preguntas de 5S
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS detailed_scores JSONB;

-- Comentario explicativo de la columna
COMMENT ON COLUMN public.audit_sessions.detailed_scores IS 'Desglose detallado de las 30 preguntas de la auditoría 5S en formato JSON { "1": 5, "2": 4, ... }';

-- Habilitar RLS y asegurar políticas para permitir inserción, actualización y eliminación
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas si existen para evitar duplicación
DROP POLICY IF EXISTS "Allow public read/write on audit_sessions" ON public.audit_sessions; 
DROP POLICY IF EXISTS "Allow public read/write on audit_sessions_v2" ON public.audit_sessions;

-- Crear una política amplia para el desarrollo que cubra INSERT, SELECT, UPDATE y DELETE
CREATE POLICY "Allow public read/write on audit_sessions" ON public.audit_sessions 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

