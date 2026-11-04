-- Casilla "Permitir Ver Lista de Precios (Manual)" del usuario en Renew OS.
-- Ejecutar una sola vez en el SQL Editor de Supabase.
alter table usuarios add column if not exists ver_lista_precios boolean default false;

-- Quien hoy la ve (tiene rango asignado) la sigue viendo; luego se ajusta con la casilla
update usuarios set ver_lista_precios = true
where ver_lista_precios is not true and coalesce(rango, 'no_aplica') <> 'no_aplica';
