-- ====================================================================
-- SUPABASE MIGRATION SCRIPT - PRODUCT CATALOG
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.product_catalog (
    code VARCHAR(50) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_description VARCHAR(150)
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write on product_catalog" ON public.product_catalog;
CREATE POLICY "Allow public read/write on product_catalog" ON public.product_catalog FOR ALL USING (true) WITH CHECK (true);

TRUNCATE TABLE public.product_catalog CASCADE;

INSERT INTO public.product_catalog (type, code, description, unit, unit_description) VALUES
('BU', 'BU850003', 'Ampliación edificios - Obra civil', 'UN', 'Unidad'),
('BU', 'BU760003', 'ESTANTERÍAS PARA PICKING', 'UN', 'Unidad'),
('ME', 'ME020007', 'Osciloscopio Tektronik', 'UN', 'Unidad'),
('BU', 'BU760005', 'Mobiliario de guardado', 'UN', 'Unidad'),
('HE', 'HE030178', 'Morsa Rectificada Apertura 125 Mm Vertex Vmv-40', 'UN', 'Unidad'),
('HE', 'HE010030', 'Taladro Dewalt', 'UN', 'Unidad'),
('IN', 'IN080110', 'Grilon Macizo Barra 110 x 110 mm.', 'MT', 'Metro'),
('ME', 'ME030041', 'Juego De Paralelas Largo 150 Mm 18 Piezas Vertex Vp-118a', 'UN', 'Unidad'),
('IN', 'IN080117', 'Aluminio Redondo Macizo Ø75 mm', 'MT', 'Metro'),
('IN', 'IN080046', 'Grilon Redondo Mazizo Ø 100 mm', 'MT', 'Metro'),
('HE', 'HE030176', 'Contrapunta liviana Torno MT4 punta estandar RC4', 'UN', 'Unidad'),
('IN', 'IN080102', 'Aluminio Redondo Macizo Ø 65 mm.', 'MT', 'Metro'),
('BU', 'BU710000', 'JLG 41 AM', 'UN', 'Unidad'),
('IN', 'IN030011', 'Electrodo E 6013 Diam 2,5 Mm', 'UN', 'Unidad'),
('HE', 'HE030179', 'Mandril Autoajustable 1-16 Jt6 Fresadora/agujereadora/torno', 'UN', 'Unidad'),
('ME', 'ME030042', 'Palpador Seteador Busca Centro Luminoso Sonoro Vertex Vps20b', 'UN', 'Unidad'),
('HE', 'HE030180', 'Contrapunta Punto Giratorio Cono Morse 4 Mt4 Para Torno', 'UN', 'Unidad'),
('IN', 'IN080126', 'Fresa Metal Duro Revestida Plana 16mm 4 Filos', 'UN', 'Unidad'),
('HE', 'HE030181', 'Contrapunta Punto Giratorio Cono Morse 2 Mt2 Para Torno', 'UN', 'Unidad'),
('HE', 'HE030155', 'Torcha MIG', 'UN', 'Unidad'),
('HE', 'HE030143', 'JUEGO DE MACHOS PARA ROSCAR', 'M12 x 1.75 mm', 'UN'),
('IN', 'IN080130', 'Acople rápido Racor M6 p/impresoras 3D', 'UN', 'Unidad'),
('IN', 'IN080131', 'Acople rápido Racor M10 p/impresora 3D', 'UN', 'Unidad'),
('IN', 'IN080132', 'Pico/Nozzle 0,4mm Bronce o similar', 'p/impresoras 3D', 'UN'),
('IN', 'IN080133', 'Tubo teflón Diam ext 4mm, diám interno 2mm por metro p/impresoras 3D', 'MT', 'Metro'),
('IN', 'IN080134', 'Hotend p/impresoras 3D solo', 'UN', 'Unidad'),
('ME', 'ME010001', 'Amperimetro Analogico', 'UN', 'Unidad'),
('ME', 'ME010002', 'Frecuenciometro De Lengüeta', 'UN', 'Unidad'),
('ME', 'ME010003', 'Luxometro Unit Ut 380', 'UN', 'Unidad'),
('ME', 'ME010004', 'Multiamperimetro Mt4W', 'UN', 'Unidad'),
('ME', 'ME010005', 'Pinza Amperometrica', 'UN', 'Unidad'),
('ME', 'ME010006', 'Voltimetro Amperimetro Wattimetro Cofimero', 'UN', 'Unidad'),
('ME', 'ME010007', 'Voltimetro Analogico 500V Ac', 'UN', 'Unidad'),
('ME', 'ME020001', 'Analizador De Espectro Siglent', 'UN', 'Unidad'),
('ME', 'ME020002', 'Generador De Funciones Owon', 'UN', 'Unidad'),
('ME', 'ME020003', 'Generador De Funciones Tti', 'UN', 'Unidad'),
('ME', 'ME020004', 'Generador De Radio Frecuencia Rigol', 'UN', 'Unidad'),
('ME', 'ME020005', 'Multimetro Fluke', 'UN', 'Unidad'),
('ME', 'ME020006', 'Multimetro Unit', 'UN', 'Unidad'),
('ME', 'ME030001', 'Alesometro Analogico', 'UN', 'Unidad'),
('ME', 'ME030002', 'Balanza De Baño 180Kg', 'UN', 'Unidad'),
('ME', 'ME030003', 'Balanza De Mano 50Kg', 'UN', 'Unidad'),
('ME', 'ME030004', 'Base De Comparador', 'Horex', 'UN'),
('ME', 'ME030005', 'Base Magnética Para Micrometro Con Indicador Moore', 'UN', 'Unidad'),
('ME', 'ME030006', 'Base Magnetica Para Reloj Comparador', 'UN', 'Unidad'),
('ME', 'ME030007', 'Block De Galgas 005 A 50Mm', 'UN', 'Unidad'),
('ME', 'ME030008', 'Calibre 500 Mm', 'UN', 'Unidad'),
('ME', 'ME030009', 'Calibre De Pie Analogico 190 A 30Cm Moore', 'UN', 'Unidad'),
('ME', 'ME030010', 'Calibre De Profundidad Analogico 150Mm Horex', 'UN', 'Unidad');
