-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - SISTEMA DE PAÑOL Y GESTIÓN DE PEDIDOS
-- Ejecutar este script en la consola SQL Editor de Supabase
-- ====================================================================

-- 1. Crear tabla de órdenes de pañol
CREATE TABLE IF NOT EXISTS public.tool_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    subject_or_project VARCHAR(255) NOT NULL,
    course VARCHAR(100) NOT NULL, -- Ej: '1°A y B', '4° TEL o TEM', etc.
    division VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Abierta' NOT NULL, -- 'Abierta', 'Cerrada'
    teacher_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    student_name VARCHAR(255) NOT NULL
);

-- Habilitar RLS en tool_orders
ALTER TABLE public.tool_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on tool_orders" ON public.tool_orders FOR ALL USING (true) WITH CHECK (true);

-- 2. Crear tabla de elementos dentro de cada orden
CREATE TABLE IF NOT EXISTS public.tool_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    order_id UUID REFERENCES public.tool_orders(id) ON DELETE CASCADE NOT NULL,
    tool_id UUID REFERENCES public.inventory(id) ON DELETE RESTRICT NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    returned_quantity INTEGER DEFAULT 0 NOT NULL,
    return_comment TEXT,
    status VARCHAR(50) DEFAULT 'Prestado' NOT NULL -- 'Prestado', 'Devuelto', 'En Reparacion'
);

-- Habilitar RLS en tool_order_items
ALTER TABLE public.tool_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read/write on tool_order_items" ON public.tool_order_items FOR ALL USING (true) WITH CHECK (true);

-- 3. Agregar columna de stock en reparación a la tabla de inventario existente
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS repair_stock INTEGER DEFAULT 0 NOT NULL;

-- 4. Agregar columna de observaciones a la tabla tool_orders para comunicación pañolero-docente
ALTER TABLE public.tool_orders ADD COLUMN IF NOT EXISTS observations TEXT;
