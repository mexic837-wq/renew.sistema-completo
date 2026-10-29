-- Firma virtual del cliente (Orden de Trabajo y Confirmación de Instalación)
-- Cada fila es un enlace único que el agente Renew Water manda por WhatsApp.
-- Solo el servidor (clave de servicio) lee y escribe esta tabla.

create table if not exists public.solicitudes_firma (
  token            text primary key,
  tipo             text not null check (tipo in ('orden_trabajo', 'confirmacion_instalacion')),
  proyecto_id      text,
  cliente_id       text,
  cliente_nombre   text,
  datos            jsonb not null,
  preview_url      text,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'procesando', 'firmado')),
  creado_por       text,
  created_at       timestamptz not null default now(),
  expira_en        timestamptz,
  firmado_en       timestamptz,
  firmante_nombre  text,
  firma_ip         text,
  pdf_url          text
);

create index if not exists solicitudes_firma_proyecto_idx on public.solicitudes_firma (proyecto_id, tipo, estado);

-- Sin políticas: el acceso público queda bloqueado; la clave de servicio del servidor sí puede usarla.
alter table public.solicitudes_firma enable row level security;
