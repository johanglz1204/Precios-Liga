-- Script SQL para creación de tablas en Supabase
-- Copia y pega este script en el SQL Editor de tu proyecto de Supabase

-- 1. TABLA DE CONFIGURACIÓN DE LA FARMACIA
-- Almacena el nombre de la farmacia, margen mínimo y listas editables de categorías y empleados.
CREATE TABLE IF NOT EXISTS configuracion (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nombre_farmacia TEXT NOT NULL DEFAULT 'Farmacia del Ahorro Local',
    margen_minimo NUMERIC NOT NULL DEFAULT 20.0,
    categorias TEXT[] NOT NULL DEFAULT ARRAY[
        'Analgésicos', 
        'Antibióticos', 
        'Vitaminas y Suplementos', 
        'Dermatológicos', 
        'Gastrointestinales', 
        'Respiratorios', 
        'Cardiovasculares',
        'Diabetes / Cuidado Especial'
    ],
    empleados TEXT[] NOT NULL DEFAULT ARRAY[
        'Farm. Carlos Mendoza', 
        'Farm. Ana Rodríguez', 
        'Farm. Luis Morales', 
        'Farm. Sofia Castro'
    ],
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insertar configuración por defecto si no existe
INSERT INTO configuracion (id, nombre_farmacia, margen_minimo)
VALUES (1, 'Farmacia San Rafael', 20.0)
ON CONFLICT (id) DO NOTHING;

-- 2. TABLA DE PRODUCTOS (CATÁLOGO Y PRECIOS PROPIOS)
-- Almacena los productos de la farmacia, sus especificaciones y precios de compra/venta propios.
CREATE TABLE IF NOT EXISTS productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    marca TEXT NOT NULL,
    categoria TEXT NOT NULL,
    presentacion TEXT NOT NULL,
    unidad_medida TEXT NOT NULL,
    costo NUMERIC NOT NULL DEFAULT 0.00,
    precio_venta NUMERIC NOT NULL DEFAULT 0.00,
    fecha_actualizacion_precio TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. TABLA DE COMPETIDORES
-- Almacena las farmacias de la competencia (máximo 8 activos).
CREATE TABLE IF NOT EXISTS competidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    notas TEXT,
    color TEXT NOT NULL DEFAULT '#10B981', -- Color identificador en hexadecimal
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insertar algunos competidores iniciales de prueba (opcional, el usuario los puede gestionar)
INSERT INTO competidores (nombre, direccion, telefono, notas, color, activo)
VALUES 
('Farmacias Similares - Centro', 'Av. Juárez #450', '555-0192', 'Cadena nacional, precios bajos los lunes', '#3B82F6', true),
('Farmacias del Ahorro - Suc. Norte', 'Blvd. Diaz Ordaz #1024', '555-0143', 'Ofrece servicio a domicilio', '#EF4444', true),
('Farmacia Benavides', 'Calle Morelos #88', '555-0177', 'Buen surtido en patentes', '#F59E0B', true),
('Farmacia Guadalajara', 'Av. Patria #1200', '555-0155', 'Supermercado 24 horas', '#10B981', true)
ON CONFLICT DO NOTHING;

-- 4. TABLA DE REGISTRO DE PRECIOS DE COMPETENCIA
-- Almacena los precios capturados para cada producto y competidor por mes calendario.
CREATE TABLE IF NOT EXISTS precios_competencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    competidor_id UUID NOT NULL REFERENCES competidores(id) ON DELETE CASCADE,
    precio NUMERIC NOT NULL,
    fecha_captura DATE NOT NULL DEFAULT CURRENT_DATE,
    empleado TEXT NOT NULL,
    notas TEXT,
    mes_calendario TEXT NOT NULL, -- Formato 'YYYY-MM'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT unique_producto_competidor_mes UNIQUE(producto_id, competidor_id, mes_calendario)
);

-- 5. DESHABILITAR ROW LEVEL SECURITY (RLS)
-- Como la aplicación es de uso interno en sucursales y usa el Anon Key, 
-- deshabilitamos RLS para permitir operaciones públicas directas desde el cliente.
ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;
ALTER TABLE productos DISABLE ROW LEVEL SECURITY;
ALTER TABLE competidores DISABLE ROW LEVEL SECURITY;
ALTER TABLE precios_competencia DISABLE ROW LEVEL SECURITY;
