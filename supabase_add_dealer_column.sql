-- Agregar columna precio_dealer a la tabla water_productos
ALTER TABLE public.water_productos
ADD COLUMN IF NOT EXISTS precio_dealer NUMERIC DEFAULT 0;
