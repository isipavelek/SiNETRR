-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - CANDIDATES & APPLICANT REVIEWS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    import_id VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    cv_url TEXT,
    
    -- Evaluaciones de CV de Coordinadores y Gerencia
    -- Formato JSONB: [{ evaluator_role: 'coordinador'|'gerente', evaluator_name: text, global_evaluation: text, request_interview: text, potential_areas: text[], potential_subjects: text[], has_pedagogical_training: text, has_teaching_experience: text, has_industry_experience: text, comments: text }]
    reviews JSONB DEFAULT '[]'::jsonb,
    
    -- Registro de Entrevista
    interview_date DATE,
    interview_description TEXT,
    interviewers TEXT[], -- Personas que estuvieron en la entrevista
    
    -- Disponibilidad Horaria
    availability_monday VARCHAR(50), -- 'Mañana', 'Tarde', 'Completo', 'No disponible'
    availability_tuesday VARCHAR(50),
    availability_wednesday VARCHAR(50),
    availability_thursday VARCHAR(50),
    availability_friday VARCHAR(50),
    availability_comments TEXT,
    
    -- Decisión Final
    possible_3ct VARCHAR(10) DEFAULT 'No', -- 'Si', 'No'
    subjects_of_interest TEXT[], -- Materias potenciales elegidas
    decision VARCHAR(50) DEFAULT 'Pendiente', -- 'Avanza a Psicotécnico', 'No por ahora', 'No', 'Pendiente'
    reasons TEXT
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write on candidates" ON public.candidates;
CREATE POLICY "Allow public read/write on candidates" ON public.candidates FOR ALL USING (true) WITH CHECK (true);
