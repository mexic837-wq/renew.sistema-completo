-- Pausas del agente Renew Water por contacto (WhatsApp).
-- Mientras un número está pausado, el agente no le contesta ni le manda recordatorios:
-- una persona atiende esa conversación desde el panel (Chats Agente IA).
-- La escribe el servidor de la app y la lee el agente en n8n (ambos con la clave de servicio).

create table if not exists public.agente_pausas (
  telefono      text primary key,     -- últimos 10 dígitos del número
  hasta         timestamptz,          -- null = hasta que alguien la quite
  pausado_por   text,                 -- usuarios.id de quien pausó
  nombre        text,                 -- nombre de quien pausó (para mostrarlo)
  creado        timestamptz not null default now()
);

-- Sin políticas: nadie con la clave pública puede leerla ni escribirla.
alter table public.agente_pausas enable row level security;
