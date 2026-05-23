-- Agregar fecha_finalizacion a Proyectos_Dinamicos
ALTER TABLE public.proyectos_dinamicos 
ADD COLUMN IF NOT EXISTS fecha_finalizacion DATE;
