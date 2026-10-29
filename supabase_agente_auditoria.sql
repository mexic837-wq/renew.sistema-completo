-- Registro de seguridad del agente Renew Water (WhatsApp).
-- Guarda quién consultó qué, y sobre todo los intentos NEGADOS (números desconocidos,
-- clientes que piden datos sensibles, usuarios que preguntan por clientes que no son suyos).
-- Solo el agente (clave de servicio) escribe aquí.

create table if not exists public.agente_auditoria (
  id          bigserial primary key,
  fecha       timestamptz not null default now(),
  telefono    text,
  usuario_id  text,
  nivel       text,                 -- admin | manager | rep | tecnico | otro | cliente
  accion      text not null,        -- consulta_estado, consulta_fuera_de_alcance, numero_desconocido, ...
  permitido   boolean not null default true,
  detalle     text
);

create index if not exists agente_auditoria_fecha_idx on public.agente_auditoria (fecha desc);
create index if not exists agente_auditoria_denegados_idx on public.agente_auditoria (permitido, fecha desc);

-- Sin políticas: nadie con la clave pública puede leerla ni escribirla.
alter table public.agente_auditoria enable row level security;

-- Para revisar intentos negados de los últimos 7 días:
-- select fecha, telefono, nivel, accion, detalle from public.agente_auditoria
--  where permitido = false and fecha > now() - interval '7 days' order by fecha desc;
