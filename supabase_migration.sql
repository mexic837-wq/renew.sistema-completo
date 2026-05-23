-- ==============================================================================
-- MIGRACIÓN PARA: OBSERVADORES Y CHAT POR PROYECTO
-- ==============================================================================

-- 1. Agregar columna observadores como JSONB (Arreglo de usuarios)
ALTER TABLE public."Proyectos_Dinamicos" 
ADD COLUMN IF NOT EXISTS observadores JSONB DEFAULT '[]'::jsonb;

-- 2. Asegurar que la columna discusion sea de tipo JSONB para almacenar los mensajes del chat
-- Si la columna NO existe:
ALTER TABLE public."Proyectos_Dinamicos"
ADD COLUMN IF NOT EXISTS discusion JSONB DEFAULT '[]'::jsonb;

-- Opcional: Si la columna 'discusion' ya existía pero era de tipo TEXT (String), 
-- descomenta y ejecuta la siguiente línea para convertirla a JSONB:
-- ALTER TABLE public."Proyectos_Dinamicos" ALTER COLUMN discusion TYPE JSONB USING discusion::JSONB;

-- 3. Asegurar que exista el flag de problema/atención
ALTER TABLE public."Proyectos_Dinamicos"
ADD COLUMN IF NOT EXISTS tiene_problema BOOLEAN DEFAULT false;
