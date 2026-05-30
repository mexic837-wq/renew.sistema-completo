-- ==============================================================================
-- MIGRACIÓN PARA: HISTORIAL DE LLAMADAS EN CLIENTES Y PROYECTOS
-- ==============================================================================

-- 1. Agregar columna historial_llamadas a clientes_maestro
ALTER TABLE public."clientes_maestro" 
ADD COLUMN IF NOT EXISTS historial_llamadas JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar columna llamadas_vinculadas a Proyectos_Dinamicos
ALTER TABLE public."Proyectos_Dinamicos"
ADD COLUMN IF NOT EXISTS llamadas_vinculadas JSONB DEFAULT '[]'::jsonb;
