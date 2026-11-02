-- Tablas de "Chats Agente IA" (panel admin) y del agente Renew Water (WhatsApp).
-- Se puede ejecutar varias veces sin problema. Todas sin políticas: solo el servidor
-- de la app y el agente (clave de servicio) las leen y escriben.

-- 1) Pausas del agente por contacto.
-- Mientras un número está pausado, el agente no le contesta ni le manda recordatorios:
-- una persona atiende esa conversación desde el panel.
create table if not exists public.agente_pausas (
  telefono      text primary key,     -- últimos 10 dígitos del número
  hasta         timestamptz,          -- null = hasta que alguien la quite
  pausado_por   text,                 -- usuarios.id de quien pausó
  nombre        text,                 -- nombre de quien pausó (para mostrarlo)
  creado        timestamptz not null default now()
);
alter table public.agente_pausas enable row level security;

-- 2) Respuestas rápidas que el equipo inserta con un clic. {nombre} = primer nombre del contacto.
create table if not exists public.agente_respuestas_rapidas (
  id          bigserial primary key,
  titulo      text not null,
  texto       text not null,
  creado_por  text,
  creado      timestamptz not null default now()
);
alter table public.agente_respuestas_rapidas enable row level security;

insert into public.agente_respuestas_rapidas (titulo, texto)
select * from (values
  ('Saludo', 'Hola {nombre} 👋, te escribe el equipo de Renew. ¿En qué te puedo ayudar?'),
  ('Pedir dirección', '{nombre}, ¿me compartes tu dirección completa (calle, ciudad y código postal) para agendar la visita?'),
  ('Confirmar cita', 'Hola {nombre}, te confirmo tu cita. Si necesitas cambiar la fecha u hora, avísame por aquí.'),
  ('Lo reviso', 'Gracias {nombre}, ya lo estoy revisando y te respondo en un momento.')
) as v(titulo, texto)
where not exists (select 1 from public.agente_respuestas_rapidas);

-- 3) Mensajes enviados a mano desde el panel (para mostrar quién escribió cada uno).
create table if not exists public.agente_mensajes_panel (
  mensaje_id  text primary key,       -- key.id del mensaje en WhatsApp
  telefono    text,
  usuario_id  text,
  nombre      text,
  enviado     timestamptz not null default now()
);
create index if not exists agente_mensajes_panel_tel_idx on public.agente_mensajes_panel (telefono);
alter table public.agente_mensajes_panel enable row level security;

-- 4) Datos de cada conversación en el panel: a quién está asignada, etiquetas y archivo.
-- clave = número completo (solo dígitos) o el jid de WhatsApp si no hay número.
create table if not exists public.agente_conversaciones (
  clave            text primary key,
  asignado_id      text,
  asignado_nombre  text,
  etiquetas        text[] not null default '{}',
  archivado_en     timestamptz,         -- si llega un mensaje nuevo después, vuelve a la bandeja
  actualizado      timestamptz not null default now(),
  actualizado_por  text
);
alter table public.agente_conversaciones enable row level security;

-- 5) Notas internas por conversación (el contacto nunca las ve).
create table if not exists public.agente_notas (
  id          bigserial primary key,
  clave       text not null,
  texto       text not null,
  usuario_id  text,
  nombre      text,
  creado      timestamptz not null default now()
);
create index if not exists agente_notas_clave_idx on public.agente_notas (clave, creado desc);
alter table public.agente_notas enable row level security;
